// Laddersu - logica de la app de escritorio (sin interfaz). C# 5 / .NET Framework 4.5+ (viene con Windows 10 y 11).
// Se compila con el csc.exe de Windows en GitHub Actions; las pruebas estan en app/LogicTest.cs.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace Laddersu
{
    public class Release
    {
        public string Version = "";
        public string Notes = "";
        public string ExeUrl = "";
        public string ExeSha256 = "";
        public long ExeSize;
        public string ExeName = "";
    }

    public static class Logic
    {
        public const string Repo = "Applexby/laddersu";
        public const string LatestJson = "https://github.com/" + Repo + "/releases/latest/download/latest.json";
        public const string ReleasesPage = "https://github.com/" + Repo + "/releases";
        public const string BundleId = "com.idealo.laddersu";

        // carpeta del panel en After Effects (la misma que usa el instalador)
        public static string ExtensionDir()
        {
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Adobe", "CEP", "extensions", BundleId);
        }

        // version instalada del panel ("" si no esta instalado)
        public static string InstalledVersion(string extDir)
        {
            try
            {
                string f = Path.Combine(extDir, "version.json");
                if (!File.Exists(f)) { return ""; }
                var d = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(f, Encoding.UTF8));
                object v;
                return d != null && d.TryGetValue("version", out v) && v != null ? Clean(v.ToString()) : "";
            }
            catch { return ""; }
        }

        public static string Clean(string v) { return (v ?? "").Trim().TrimStart('v', 'V'); }

        // 1 si a > b, -1 si a < b, 0 si iguales. Compara numero por numero ("0.6.10" > "0.6.9").
        public static int Compare(string a, string b)
        {
            string[] x = Clean(a).Split('.'), y = Clean(b).Split('.');
            int n = Math.Max(x.Length, y.Length);
            for (int i = 0; i < n; i++)
            {
                int p = i < x.Length ? ToInt(x[i]) : 0, q = i < y.Length ? ToInt(y[i]) : 0;
                if (p != q) { return p > q ? 1 : -1; }
            }
            return 0;
        }
        static int ToInt(string s) { var m = Regex.Match(s ?? "", @"^\d+"); int r; return m.Success && int.TryParse(m.Value, out r) ? r : 0; }

        // latest.json publicado con cada version (ver tools/make-latest.js)
        public static Release ParseLatest(string json)
        {
            var d = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(json);
            if (d == null || !d.ContainsKey("version")) { throw new Exception("latest.json sin version"); }
            var r = new Release();
            r.Version = Clean(Convert.ToString(d["version"]));
            r.Notes = d.ContainsKey("notes") ? Convert.ToString(d["notes"]) : "";
            if (d.ContainsKey("exe") && d["exe"] is Dictionary<string, object>)
            {
                var e = (Dictionary<string, object>)d["exe"];
                r.ExeUrl = e.ContainsKey("url") ? Convert.ToString(e["url"]) : "";
                r.ExeSha256 = e.ContainsKey("sha256") ? Convert.ToString(e["sha256"]).ToLowerInvariant() : "";
                r.ExeName = e.ContainsKey("name") ? Convert.ToString(e["name"]) : "";
                r.ExeSize = e.ContainsKey("size") ? Convert.ToInt64(e["size"]) : 0;
            }
            if (r.ExeUrl == "") { throw new Exception("latest.json sin instalador"); }
            return r;
        }

        // notas en texto plano: sin **negritas** ni `codigo`, una novedad por linea
        public static string PlainNotes(string md)
        {
            var sb = new StringBuilder();
            foreach (var raw in (md ?? "").Replace("\r", "").Split('\n'))
            {
                string l = raw.Trim();
                if (l == "" || l.StartsWith("#")) { continue; }
                l = Regex.Replace(l, @"^[-*]\s+", "• ");
                l = l.Replace("**", "").Replace("`", "");
                sb.Append(l).Append("\r\n");
            }
            return sb.ToString().TrimEnd();
        }

        public static string Sha256File(string path)
        {
            using (var s = File.OpenRead(path))
            using (var h = SHA256.Create())
            {
                var b = h.ComputeHash(s);
                var sb = new StringBuilder();
                foreach (var x in b) { sb.Append(x.ToString("x2")); }
                return sb.ToString();
            }
        }

        public static void EnableTls()
        {
            // .NET Framework compilado sin config puede quedarse en TLS 1.0: GitHub exige TLS 1.2
            try { ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072; } catch { }
        }

        public static WebClient Client()
        {
            var w = new WebClient();
            w.Headers[HttpRequestHeader.UserAgent] = "Laddersu-App";
            w.Encoding = Encoding.UTF8;
            return w;
        }

        public static async Task<Release> FetchLatest(string url)
        {
            EnableTls();
            using (var w = Client())
            {
                string json = await w.DownloadStringTaskAsync(new Uri(url + (url.Contains("?") ? "&" : "?") + "t=" + DateTime.UtcNow.Ticks));
                return ParseLatest(json);
            }
        }

        // descarga el instalador y comprueba su huella; devuelve la ruta del .exe
        public static async Task<string> DownloadInstaller(Release r, string dir, Action<int> progress)
        {
            EnableTls();
            Directory.CreateDirectory(dir);
            string name = r.ExeName != "" ? r.ExeName : "Laddersu-Setup-" + r.Version + ".exe";
            string dest = Path.Combine(dir, name), tmp = dest + ".part";
            if (File.Exists(tmp)) { File.Delete(tmp); }
            using (var w = Client())
            {
                if (progress != null) { w.DownloadProgressChanged += (s, e) => progress(e.ProgressPercentage); }
                await w.DownloadFileTaskAsync(new Uri(r.ExeUrl), tmp);
            }
            string sha = Sha256File(tmp);
            if (r.ExeSha256 != "" && sha != r.ExeSha256)
            {
                File.Delete(tmp);
                throw new Exception("La descarga llego dañada (la huella no coincide). Intenta de nuevo.");
            }
            if (File.Exists(dest)) { File.Delete(dest); }
            File.Move(tmp, dest);
            return dest;
        }

        // instala en silencio (con su barra de progreso); al terminar el instalador vuelve a abrir la app
        public static Process RunInstaller(string exe)
        {
            var psi = new ProcessStartInfo(exe, "/SILENT /SUPPRESSMSGBOXES /NORESTART /SP-");
            psi.UseShellExecute = true;
            return Process.Start(psi);
        }

        public static bool AfterEffectsOpen()
        {
            try { return Process.GetProcessesByName("AfterFX").Length > 0; } catch { return false; }
        }
    }
}
