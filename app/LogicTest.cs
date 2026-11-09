// Pruebas de la logica de la app (consola). En GitHub Actions se compilan con el csc.exe de Windows y se ejecutan
// antes de armar el instalador. Con LADDERSU_ONLINE=1 tambien lee el latest.json publicado.
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;

namespace Laddersu
{
    static class LogicTest
    {
        static int fails, ok;
        static void Check(bool c, string m) { if (c) { ok++; Console.WriteLine("ok   " + m); } else { fails++; Console.WriteLine("FAIL " + m); } }

        static int Main()
        {
            Check(Logic.Compare("0.6.10", "0.6.9") == 1, "compara numero por numero");
            Check(Logic.Compare("v0.6.1", "0.6.1") == 0, "ignora la v");
            Check(Logic.Compare("0.6", "0.6.1") == -1, "versiones cortas");
            Check(Logic.Compare("1.0.0", "0.9.9") == 1, "mayor");

            string json = "{\"version\":\"0.6.2\",\"notes\":\"- **Nuevo** estilo\\r\\n- Usa `sounds/user`\",\"zip\":{\"name\":\"z.zip\",\"url\":\"https://x/z.zip\",\"sha256\":\"aa\",\"size\":1}," +
                          "\"exe\":{\"name\":\"Laddersu-Setup-0.6.2.exe\",\"url\":\"https://x/s.exe\",\"sha256\":\"ABC\",\"size\":2524425}}";
            var r = Logic.ParseLatest(json);
            Check(r.Version == "0.6.2" && r.ExeUrl == "https://x/s.exe" && r.ExeSha256 == "abc" && r.ExeSize == 2524425 && r.ExeName == "Laddersu-Setup-0.6.2.exe", "lee latest.json");
            Check(Logic.PlainNotes(r.Notes) == "• Nuevo estilo\r\n• Usa sounds/user", "notas en texto plano");
            bool threw = false; try { Logic.ParseLatest("{\"version\":\"1\"}"); } catch { threw = true; }
            Check(threw, "latest.json sin instalador da error");

            string dir = Path.Combine(Path.GetTempPath(), "laddersu-test-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(dir);
            Check(Logic.InstalledVersion(dir) == "", "sin panel instalado");
            File.WriteAllText(Path.Combine(dir, "version.json"), "{ \"version\": \"0.6.1\" }");
            Check(Logic.InstalledVersion(dir) == "0.6.1", "version instalada");
            File.WriteAllText(Path.Combine(dir, "a.txt"), "abc");
            Check(Logic.Sha256File(Path.Combine(dir, "a.txt")) == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "huella sha256");

            // descarga desde un servidor local (con redireccion, como GitHub)
            int port = 18000 + new Random().Next(2000);
            var payload = Encoding.UTF8.GetBytes("instalador falso");
            var http = new HttpListener(); http.Prefixes.Add("http://127.0.0.1:" + port + "/"); http.Start();
            var th = new Thread(() => {
                try {
                    while (http.IsListening) {
                        var c = http.GetContext();
                        if (c.Request.Url.AbsolutePath == "/redir") { c.Response.StatusCode = 302; c.Response.RedirectLocation = "/file"; c.Response.Close(); continue; }
                        c.Response.ContentLength64 = payload.Length; c.Response.OutputStream.Write(payload, 0, payload.Length); c.Response.Close();
                    }
                } catch { }
            });
            th.IsBackground = true; th.Start();
            string sha;
            using (var h = System.Security.Cryptography.SHA256.Create()) { sha = BitConverter.ToString(h.ComputeHash(payload)).Replace("-", "").ToLowerInvariant(); }
            var rel = new Release { Version = "9.9.9", ExeUrl = "http://127.0.0.1:" + port + "/redir", ExeSha256 = sha, ExeName = "Setup-test.exe" };
            int last = -1;
            string got = Logic.DownloadInstaller(rel, dir, p => last = p).Result;
            Check(File.Exists(got) && File.ReadAllText(got) == "instalador falso" && !File.Exists(got + ".part"), "descarga el instalador siguiendo la redireccion");
            rel.ExeSha256 = "00"; threw = false;
            try { Logic.DownloadInstaller(rel, dir, null).Wait(); } catch (AggregateException ae) { threw = ae.InnerException.Message.Contains("huella"); }
            Check(threw && !File.Exists(Path.Combine(dir, "Setup-test.exe.part")), "rechaza una descarga con huella distinta");
            http.Stop();

            if (Environment.GetEnvironmentVariable("LADDERSU_ONLINE") == "1")
            {
                var lat = Logic.FetchLatest(Logic.LatestJson).Result;
                Check(lat.Version != "" && lat.ExeUrl.StartsWith("https://github.com/"), "lee la version publicada en GitHub (" + lat.Version + ")");
            }
            try { Directory.Delete(dir, true); } catch { }
            Console.WriteLine(ok + " pruebas de la app OK, " + fails + " fallos");
            return fails == 0 ? 0 : 1;
        }
    }
}
