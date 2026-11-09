// Laddersu - app de escritorio para actualizar el panel de After Effects.
// Abre, compara la version instalada con la ultima publicada en GitHub y, si hay una nueva, la instala con un clic.
using System;
using System.Collections.Generic;
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
        static readonly Color Bg = Color.FromArgb(19, 19, 21), Side = Color.FromArgb(24, 24, 27), Card = Color.FromArgb(32, 32, 36), Line = Color.FromArgb(48, 48, 54);
        static readonly Color Text1 = Color.FromArgb(240, 240, 242), Mut = Color.FromArgb(160, 160, 170), Dim = Color.FromArgb(120, 120, 130);
        static readonly Color Violet = Color.FromArgb(124, 92, 255), Violet2 = Color.FromArgb(169, 150, 255), Green = Color.FromArgb(74, 222, 128), Amber = Color.FromArgb(251, 191, 36);
        const int SW = 300;

        readonly Label instVer = new Label(), state = new Label(), sub2 = new Label(), aeNote = new Label(), notesHead = new Label(), notesSub = new Label();
        readonly RichTextBox notes = new RichTextBox();
        readonly ProgressBar bar = new ProgressBar();
        readonly Button main = new Button(), check = new Button();
        readonly bool justUpdated;
        Release latest;
        List<ReleaseNote> history;
        string installed = "";
        bool busy;

        public MainForm(bool updated)
        {
            justUpdated = updated;
            SuspendLayout();
            AutoScaleDimensions = new SizeF(96F, 96F);
            AutoScaleMode = AutoScaleMode.Dpi;
            Text = "Laddersu";
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            FormBorderStyle = FormBorderStyle.None; MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(940, 620);
            BackColor = Bg; ForeColor = Text1;
            Font = new Font("Segoe UI", 10f);

            // ---------- columna izquierda ----------
            var side = new Panel { Location = new Point(0, 0), Size = new Size(SW, 620 - TitleBar.H), BackColor = Side };
            side.Paint += (s, e) => { using (var p = new Pen(Line)) { e.Graphics.DrawLine(p, side.Width - 1, 0, side.Width - 1, side.Height); } };
            Controls.Add(side);

            var logo = new LogoMark { Location = new Point(28, 28), Size = new Size(34, 32), BackColor = Side };
            side.Controls.Add(logo);
            var name = new Label { Text = "Laddersu", Font = new Font("Segoe UI Semibold", 18f), AutoSize = true, Location = new Point(70, 22), BackColor = Side };
            side.Controls.Add(name);
            var tag = new Label { Text = "Subtítulos animados para AE", ForeColor = Mut, AutoSize = true, Location = new Point(72, 56), BackColor = Side, Font = new Font("Segoe UI", 9f) };
            side.Controls.Add(tag);

            var card = new Panel { Location = new Point(24, 100), Size = new Size(SW - 48, 132), BackColor = Card };
            card.Paint += (s, e) => { using (var p = new Pen(Line)) { e.Graphics.DrawRectangle(p, 0, 0, card.Width - 1, card.Height - 1); } };
            var lab = new Label { Text = "VERSIÓN INSTALADA", ForeColor = Dim, AutoSize = true, Location = new Point(16, 14), BackColor = Card, Font = new Font("Segoe UI Semibold", 8.25f) };
            instVer.Font = new Font("Segoe UI Semibold", 24f); instVer.AutoSize = true; instVer.Location = new Point(13, 32); instVer.BackColor = Card; instVer.Text = "—";
            state.Font = new Font("Segoe UI Semibold", 10.5f); state.AutoSize = false; state.Location = new Point(16, 80); state.Size = new Size(card.Width - 28, 22); state.BackColor = Card;
            sub2.ForeColor = Mut; sub2.AutoSize = false; sub2.Location = new Point(16, 103); sub2.Size = new Size(card.Width - 28, 20); sub2.BackColor = Card; sub2.Font = new Font("Segoe UI", 9f);
            card.Controls.Add(lab); card.Controls.Add(instVer); card.Controls.Add(state); card.Controls.Add(sub2);
            side.Controls.Add(card);

            Style(main, true); main.Location = new Point(24, 248); main.Size = new Size(SW - 48, 44); main.Text = "Actualizar"; main.Visible = false;
            main.Click += async (s, e) => await DoUpdate();
            side.Controls.Add(main);
            Style(check, false); check.Location = new Point(24, 300); check.Size = new Size(SW - 48, 40); check.Text = "Buscar actualizaciones";
            check.Click += async (s, e) => await Check();
            side.Controls.Add(check);
            bar.Location = new Point(24, 350); bar.Size = new Size(SW - 48, 6); bar.Visible = false; bar.Style = ProgressBarStyle.Continuous;
            side.Controls.Add(bar);
            aeNote.ForeColor = Amber; aeNote.AutoSize = false; aeNote.Location = new Point(24, 350); aeNote.Size = new Size(SW - 48, 40); aeNote.Visible = false; aeNote.BackColor = Side;
            aeNote.Font = new Font("Segoe UI", 9f);
            aeNote.Text = "After Effects está abierto: reinícialo después de actualizar para ver los cambios.";
            side.Controls.Add(aeNote);

            int ly = 410;
            foreach (var l in new[] { new[] { "Sitio web", Logic.WebUrl }, new[] { "Guía de uso", Logic.WebUrl + "/guia/" }, new[] { "Novedades en la web", Logic.WebUrl + "/novedades/" }, new[] { "Reportar un problema", Logic.WebUrl + "/consultas/" } })
            {
                var url = l[1];
                var ll = new LinkLabel { Text = l[0], AutoSize = true, Location = new Point(24, ly), LinkColor = Violet2, ActiveLinkColor = Text1, LinkBehavior = LinkBehavior.HoverUnderline, BackColor = Side };
                ll.LinkClicked += (s, e) => Open(url);
                side.Controls.Add(ll); ly += 26;
            }
            var credit = new Label { Text = "Hecho por Applexby", ForeColor = Mut, AutoSize = true, Location = new Point(24, 620 - TitleBar.H - 52), BackColor = Side, Font = new Font("Segoe UI Semibold", 9f) };
            var copy = new Label { Text = "© 2026 Applexby · Laddersu", ForeColor = Dim, AutoSize = true, Location = new Point(24, 620 - TitleBar.H - 32), BackColor = Side, Font = new Font("Segoe UI", 8.25f) };
            side.Controls.Add(credit); side.Controls.Add(copy);

            // ---------- novedades ----------
            notesHead.Text = "Novedades"; notesHead.Font = new Font("Segoe UI Semibold", 16f); notesHead.AutoSize = true; notesHead.Location = new Point(SW + 32, 24);
            Controls.Add(notesHead);
            notesSub.Text = "Lo que trae cada versión"; notesSub.ForeColor = Mut; notesSub.AutoSize = true; notesSub.Location = new Point(SW + 34, 56);
            Controls.Add(notesSub);
            var box = new Panel { Location = new Point(SW + 28, 92), Size = new Size(940 - SW - 56, 620 - TitleBar.H - 92 - 28), BackColor = Card, Padding = new Padding(18, 14, 8, 14) };
            box.Paint += (s, e) => { using (var p = new Pen(Line)) { e.Graphics.DrawRectangle(p, 0, 0, box.Width - 1, box.Height - 1); } };
            notes.Dock = DockStyle.Fill; notes.ReadOnly = true; notes.BorderStyle = BorderStyle.None; notes.BackColor = Card; notes.ForeColor = Text1;
            notes.ScrollBars = RichTextBoxScrollBars.Vertical; notes.TabStop = false; notes.DetectUrls = false; notes.Font = new Font("Segoe UI", 10.5f);
            box.Controls.Add(notes);
            Controls.Add(box);

            // barra de titulo propia (botones rojo, amarillo y verde a la izquierda, como en macOS)
            foreach (Control c in Controls) { c.Top += TitleBar.H; }
            ClientSize = new Size(940, 620);
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
            b.FlatAppearance.MouseOverBackColor = primary ? Color.FromArgb(109, 79, 240) : Color.FromArgb(44, 44, 50);
            b.BackColor = primary ? Violet : Card; b.ForeColor = Color.White; b.Cursor = Cursors.Hand;
            b.Font = new Font("Segoe UI Semibold", 10.5f);
        }
        static void Open(string url) { try { Process.Start(url); } catch { } }

        void SetState(string st, Color c, string v)
        {
            state.Text = st; state.ForeColor = c; sub2.Text = v;
        }

        // novedades con formato: version en grande, fecha, etiqueta y cada cambio con su punto
        void ShowNotes()
        {
            notes.Clear();
            var list = history;
            if ((list == null || list.Count == 0) && latest != null) { list = new List<ReleaseNote> { new ReleaseNote { Version = latest.Version, Body = latest.Notes } }; }
            if (list == null || list.Count == 0) { Add("No se pudieron cargar las novedades.", 10.5f, false, Mut); return; }
            bool first = true;
            foreach (var r in list)
            {
                if (!first) { Add("\n", 8f, false, Text1); }
                first = false;
                Add(r.Version, 15f, true, Text1);
                string badge = "";
                Color bc = Mut;
                if (latest != null && r.Version == latest.Version && installed != "" && Logic.Compare(r.Version, installed) > 0) { badge = "   NUEVA"; bc = Amber; }
                else if (r.Version == installed) { badge = "   INSTALADA"; bc = Green; }
                if (badge != "") { Add(badge, 8.5f, true, bc); }
                string d = Logic.SpanishDate(r.Date);
                if (d != "") { Add("   " + d, 9.5f, false, Dim); }
                Add("\n", 6f, false, Text1);
                var bullets = Logic.Bullets(r.Body);
                if (bullets.Count == 0) { bullets.Add("Mejoras y correcciones."); }
                foreach (var bl in bullets)
                {
                    notes.SelectionStart = notes.TextLength; notes.SelectionIndent = 14; notes.SelectionHangingIndent = 14;
                    Add("•  ", 10.5f, true, Violet2);
                    foreach (var run in Logic.Runs(bl)) { Add(run.Key, 10.5f, run.Value, run.Value ? Text1 : Color.FromArgb(205, 205, 212)); }
                    Add("\n", 4f, false, Text1);
                    notes.SelectionStart = notes.TextLength; notes.SelectionIndent = 0; notes.SelectionHangingIndent = 0;
                }
            }
            notes.SelectionStart = 0; notes.ScrollToCaret();
        }
        void Add(string t, float size, bool bold, Color c)
        {
            notes.SelectionStart = notes.TextLength; notes.SelectionLength = 0;
            notes.SelectionFont = new Font(bold ? "Segoe UI Semibold" : "Segoe UI", size);
            notes.SelectionColor = c;
            notes.AppendText(t);
        }

        async System.Threading.Tasks.Task Check()
        {
            if (busy) { return; }
            busy = true; main.Visible = false; check.Enabled = false; check.Text = "Buscando…";
            installed = Logic.InstalledVersion(Logic.ExtensionDir());
            instVer.Text = installed != "" ? installed : "—";
            SetState("Buscando la última versión…", Text1, "");
            try
            {
                latest = await Logic.FetchLatest(Logic.LatestJson);
                try { history = await Logic.FetchReleases(); } catch { history = null; }
                if (installed == "")
                {
                    SetState("El panel no está instalado", Amber, "Última versión publicada: " + latest.Version);
                    main.Text = "Instalar " + latest.Version; main.Visible = true;
                }
                else if (Logic.Compare(latest.Version, installed) > 0)
                {
                    SetState("Hay una versión nueva: " + latest.Version, Amber, "A la derecha ves lo que trae.");
                    main.Text = "Actualizar a " + latest.Version; main.Visible = true;
                }
                else
                {
                    SetState(justUpdated ? "Actualizado a la última versión" : "Tienes la última versión", Green, "Revisado " + DateTime.Now.ToString("HH:mm"));
                }
                ShowNotes();
            }
            catch (Exception ex)
            {
                SetState("No se pudo revisar", Amber, "Revisa tu conexión a internet.");
                notes.Clear(); Add("No se pudieron cargar las novedades (" + Short(ex) + ").", 10.5f, false, Mut);
            }
            aeNote.Visible = Logic.AfterEffectsOpen() && main.Visible;
            busy = false; check.Enabled = true; check.Text = "Buscar actualizaciones";
        }

        async System.Threading.Tasks.Task DoUpdate()
        {
            if (busy || latest == null) { return; }
            busy = true; main.Enabled = false; check.Enabled = false; aeNote.Visible = false;
            bar.Visible = true; bar.Value = 0;
            SetState("Descargando " + latest.Version + "…", Text1, "");
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
                busy = false; main.Enabled = true; check.Enabled = true;
            }
        }

        static string Short(Exception ex)
        {
            string m = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
            return m.Length > 70 ? m.Substring(0, 70) + "…" : m;
        }
    }

    // el isotipo de Laddersu (tres escalones)
    class LogoMark : Control
    {
        public LogoMark() { SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.SupportsTransparentBackColor, true); }
        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics; float u = Math.Min(Width / 34f, Height / 32f);
            using (var a = new SolidBrush(Color.FromArgb(124, 92, 255))) { g.FillRectangle(a, 0, 18 * u, 15 * u, 13 * u); }
            using (var b = new SolidBrush(Color.FromArgb(169, 150, 255))) { g.FillRectangle(b, 9 * u, 9 * u, 15 * u, 13 * u); }
            using (var c = new SolidBrush(Color.FromArgb(245, 165, 36))) { g.FillRectangle(c, 19 * u, 0, 15 * u, 13 * u); }
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
