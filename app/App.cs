// Laddersu - app de escritorio para actualizar el panel de After Effects.
// Abre, compara la version instalada con la ultima publicada en GitHub y, si hay una nueva, la instala con un clic.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
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
            FormBorderStyle = FormBorderStyle.None; MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            AutoScaleMode = AutoScaleMode.Dpi;
            ClientSize = new Size(420, 360 + TitleBar.H);
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

            // barra de titulo propia (botones rojo, amarillo y verde a la izquierda, como en macOS)
            foreach (Control c in Controls) { c.Top += TitleBar.H; }
            var tb = new TitleBar(this); tb.Dock = DockStyle.Top;
            Controls.Add(tb);
            ResumeLayout(false);
            PerformLayout();
            Shown += async (s, e) => await Check();
        }

        // ventana sin el marco de Windows: sombra, esquinas redondeadas en Windows 11 y borde fino
        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ClassStyle |= 0x20000;             // CS_DROPSHADOW
                cp.Style |= 0x20000 | 0x80000;        // WS_MINIMIZEBOX | WS_SYSMENU: minimizar desde la barra de tareas
                return cp;
            }
        }
        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr h, int attr, ref int val, int size);
        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            try { int round = 2; DwmSetWindowAttribute(Handle, 33, ref round, 4); } catch { }
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (var p = new Pen(Line)) { e.Graphics.DrawRectangle(p, 0, 0, ClientSize.Width - 1, ClientSize.Height - 1); }
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

    // Barra de titulo: cerrar (rojo), minimizar (amarillo) y verde decorativo; se arrastra para mover la ventana.
    class TitleBar : Control
    {
        public const int H = 38;
        static readonly Color[] Dots = { Color.FromArgb(255, 95, 87), Color.FromArgb(254, 188, 46), Color.FromArgb(40, 200, 64) };
        readonly Form form;
        bool hover;
        [DllImport("user32.dll")] static extern bool ReleaseCapture();
        [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, int msg, IntPtr w, IntPtr l);

        public TitleBar(Form f)
        {
            form = f; Height = H;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
            BackColor = Color.FromArgb(27, 27, 30);
        }
        Rectangle Dot(int i) { int d = 12; return new Rectangle(14 + i * 20, (H - d) / 2, d, d); }
        int Hit(Point p) { for (int i = 0; i < 3; i++) { var r = Dot(i); r.Inflate(3, 3); if (r.Contains(p)) { return i; } } return -1; }
        bool InGroup(Point p) { return p.X >= 8 && p.X <= 14 + 2 * 20 + 18 && p.Y >= 6 && p.Y <= H - 6; }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics; g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            using (var t = new SolidBrush(Color.FromArgb(150, 150, 160)))
            using (var f = new Font("Segoe UI Semibold", 9f))
            {
                var sz = g.MeasureString("Laddersu", f);
                g.DrawString("Laddersu", f, t, (Width - sz.Width) / 2, (H - sz.Height) / 2);
            }
            for (int i = 0; i < 3; i++)
            {
                var r = Dot(i);
                using (var b = new SolidBrush(Dots[i])) { g.FillEllipse(b, r); }
                using (var pe = new Pen(Color.FromArgb(40, 0, 0, 0))) { g.DrawEllipse(pe, r); }
                if (hover)
                {
                    using (var pen = new Pen(Color.FromArgb(150, 40, 20, 10), 1.4f))
                    {
                        float cx = r.X + r.Width / 2f, cy = r.Y + r.Height / 2f, k = 2.6f;
                        if (i == 0) { g.DrawLine(pen, cx - k, cy - k, cx + k, cy + k); g.DrawLine(pen, cx - k, cy + k, cx + k, cy - k); }
                        else if (i == 1) { g.DrawLine(pen, cx - k - .4f, cy, cx + k + .4f, cy); }
                        else { g.DrawLine(pen, cx - k, cy, cx + k, cy); g.DrawLine(pen, cx, cy - k, cx, cy + k); }
                    }
                }
            }
            using (var l = new Pen(Color.FromArgb(48, 48, 54))) { g.DrawLine(l, 0, H - 1, Width, H - 1); }
        }
        protected override void OnMouseMove(MouseEventArgs e)
        {
            bool h = InGroup(e.Location);
            if (h != hover) { hover = h; Invalidate(); }
            Cursor = Hit(e.Location) >= 0 ? Cursors.Hand : Cursors.Default;
            base.OnMouseMove(e);
        }
        protected override void OnMouseLeave(EventArgs e) { if (hover) { hover = false; Invalidate(); } base.OnMouseLeave(e); }
        protected override void OnMouseDown(MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) { return; }
            int i = Hit(e.Location);
            if (i == 0) { form.Close(); return; }
            if (i == 1) { form.WindowState = FormWindowState.Minimized; return; }
            if (i == 2) { return; }
            // arrastrar la ventana
            try { ReleaseCapture(); SendMessage(form.Handle, 0xA1, (IntPtr)2, IntPtr.Zero); } catch { }
        }
    }
}
