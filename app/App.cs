// Laddersu - app de escritorio para actualizar el panel de After Effects.
// Abre, compara la version instalada con la ultima publicada en GitHub y, si hay una nueva, la instala con un clic.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace Laddersu
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            bool created;
            using (var m = new Mutex(true, "Laddersu.App.SingleInstance", out created))
            {
                if (!created) { return; }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                bool updated = Array.IndexOf(args, "--updated") >= 0;
                Application.Run(new MainForm(updated));
            }
        }
    }

    class MainForm : Form
    {
        static readonly Color Bg = Color.FromArgb(19, 19, 21), Card = Color.FromArgb(30, 30, 34), Line = Color.FromArgb(48, 48, 54);
        static readonly Color Text1 = Color.FromArgb(240, 240, 242), Mut = Color.FromArgb(150, 150, 160);
        static readonly Color Violet = Color.FromArgb(124, 92, 255), Green = Color.FromArgb(74, 222, 128), Amber = Color.FromArgb(251, 191, 36);

        readonly Label title = new Label(), state = new Label(), vers = new Label(), aeNote = new Label();
        readonly TextBox notes = new TextBox();
        readonly ProgressBar bar = new ProgressBar();
        readonly Button main = new Button(), again = new Button();
        readonly LinkLabel web = new LinkLabel();
        readonly bool justUpdated;
        Release latest;
        string installed = "";
        bool busy;

        public MainForm(bool updated)
        {
            justUpdated = updated;
            SuspendLayout();
            AutoScaleDimensions = new SizeF(96F, 96F);
            Text = "Laddersu";
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            FormBorderStyle = FormBorderStyle.FixedSingle; MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            AutoScaleMode = AutoScaleMode.Dpi;
            ClientSize = new Size(420, 360);
            BackColor = Bg; ForeColor = Text1;
            Font = new Font("Segoe UI", 9.75f);

            var logo = new PictureBox { Location = new Point(22, 20), Size = new Size(36, 36), SizeMode = PictureBoxSizeMode.Zoom, BackColor = Bg };
            try { logo.Image = Icon.ExtractAssociatedIcon(Application.ExecutablePath).ToBitmap(); } catch { }
            Controls.Add(logo);
            title.Text = "Laddersu"; title.Font = new Font("Segoe UI Semibold", 15f); title.AutoSize = true; title.Location = new Point(64, 16);
            Controls.Add(title);
            var sub = new Label { Text = "Actualizaciones del panel de After Effects", ForeColor = Mut, AutoSize = true, Location = new Point(66, 44) };
            Controls.Add(sub);

            var card = new Panel { Location = new Point(22, 78), Size = new Size(376, 72), BackColor = Card };
            card.Paint += (s, e) => { using (var p = new Pen(Line)) { e.Graphics.DrawRectangle(p, 0, 0, card.Width - 1, card.Height - 1); } };
            state.Font = new Font("Segoe UI Semibold", 11.5f); state.AutoSize = false; state.Location = new Point(14, 12); state.Size = new Size(350, 24); state.BackColor = Card;
            vers.ForeColor = Mut; vers.AutoSize = false; vers.Location = new Point(14, 40); vers.Size = new Size(350, 20); vers.BackColor = Card;
            card.Controls.Add(state); card.Controls.Add(vers);
            Controls.Add(card);

            var nl = new Label { Text = "Novedades", ForeColor = Mut, AutoSize = true, Location = new Point(22, 162) };
            Controls.Add(nl);
            notes.Multiline = true; notes.ReadOnly = true; notes.ScrollBars = ScrollBars.Vertical; notes.BorderStyle = BorderStyle.FixedSingle;
            notes.BackColor = Card; notes.ForeColor = Text1; notes.Location = new Point(22, 182); notes.Size = new Size(376, 96); notes.TabStop = false;
            Controls.Add(notes);

            bar.Location = new Point(22, 286); bar.Size = new Size(376, 6); bar.Visible = false; bar.Style = ProgressBarStyle.Continuous;
            Controls.Add(bar);
            aeNote.ForeColor = Amber; aeNote.AutoSize = false; aeNote.Location = new Point(22, 284); aeNote.Size = new Size(376, 18); aeNote.Visible = false;
            aeNote.Text = "After Effects está abierto: reinícialo después de actualizar.";
            Controls.Add(aeNote);

            Style(main, true); main.Location = new Point(22, 312); main.Size = new Size(170, 34); main.Text = "Actualizar"; main.Enabled = false;
            main.Click += async (s, e) => await DoUpdate();
            Controls.Add(main);
            Style(again, false); again.Location = new Point(200, 312); again.Size = new Size(136, 34); again.Text = "Buscar de nuevo";
            again.Click += async (s, e) => await Check();
            Controls.Add(again);
            web.Text = "Versiones"; web.AutoSize = true; web.LinkColor = Color.FromArgb(169, 150, 255); web.ActiveLinkColor = Text1; web.Location = new Point(344, 321);
            web.LinkClicked += (s, e) => { try { Process.Start(Logic.ReleasesPage); } catch { } };
            Controls.Add(web);
            AcceptButton = main;

            ResumeLayout(false);
            PerformLayout();
            Shown += async (s, e) => await Check();
        }

        static void Style(Button b, bool primary)
        {
            b.FlatStyle = FlatStyle.Flat; b.FlatAppearance.BorderSize = primary ? 0 : 1; b.FlatAppearance.BorderColor = Line;
            b.BackColor = primary ? Violet : Card; b.ForeColor = Color.White; b.Cursor = Cursors.Hand;
            b.Font = new Font("Segoe UI Semibold", 9.75f);
        }

        void SetState(string st, Color c, string v)
        {
            state.Text = st; state.ForeColor = c; vers.Text = v;
        }

        async System.Threading.Tasks.Task Check()
        {
            if (busy) { return; }
            busy = true; main.Enabled = false; again.Enabled = false;
            installed = Logic.InstalledVersion(Logic.ExtensionDir());
            SetState("Buscando la última versión…", Text1, installed != "" ? "Instalada: " + installed : "El panel no está instalado en este equipo");
            try
            {
                latest = await Logic.FetchLatest(Logic.LatestJson);
                notes.Text = Logic.PlainNotes(latest.Notes);
                string v = (installed != "" ? "Instalada: " + installed + "   ·   " : "") + "Publicada: " + latest.Version;
                if (installed == "")
                {
                    SetState("Laddersu no está instalado", Amber, v);
                    main.Text = "Instalar " + latest.Version; main.Enabled = true;
                }
                else if (Logic.Compare(latest.Version, installed) > 0)
                {
                    SetState("Hay una versión nueva: " + latest.Version, Amber, v);
                    main.Text = "Actualizar a " + latest.Version; main.Enabled = true;
                }
                else
                {
                    SetState(justUpdated ? "Listo: tienes Laddersu " + installed : "Tienes la última versión", Green, v);
                    main.Text = "Al día"; main.Enabled = false;
                }
            }
            catch (Exception ex)
            {
                SetState("No se pudo revisar", Amber, "Revisa tu conexión a internet. (" + Short(ex) + ")");
            }
            aeNote.Visible = Logic.AfterEffectsOpen() && main.Enabled;
            busy = false; again.Enabled = true;
        }

        async System.Threading.Tasks.Task DoUpdate()
        {
            if (busy || latest == null) { return; }
            busy = true; main.Enabled = false; again.Enabled = false; aeNote.Visible = false;
            bar.Visible = true; bar.Value = 0;
            SetState("Descargando " + latest.Version + "…", Text1, vers.Text);
            try
            {
                string dir = Path.Combine(Path.GetTempPath(), "Laddersu");
                string exe = await Logic.DownloadInstaller(latest, dir, p => { try { BeginInvoke((Action)(() => { bar.Value = Math.Max(0, Math.Min(100, p)); })); } catch { } });
                SetState("Instalando…", Text1, "La app se vuelve a abrir al terminar.");
                Logic.RunInstaller(exe);
                Close();   // el instalador reemplaza esta app y la vuelve a abrir
            }
            catch (Exception ex)
            {
                bar.Visible = false;
                SetState("No se pudo actualizar", Amber, Short(ex));
                busy = false; main.Enabled = true; again.Enabled = true;
            }
        }

        static string Short(Exception ex)
        {
            string m = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
            return m.Length > 90 ? m.Substring(0, 90) + "…" : m;
        }
    }
}
