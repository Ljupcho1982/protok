// Protok launcher. Opens Protok.html (next to this exe) in its own app window using the
// browser that is already on the machine: Edge (built into Windows 10/11), then Chrome or Brave,
// and finally the default browser. Nothing is installed and nothing is written to disk.
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: System.Reflection.AssemblyTitle("Protok")]
[assembly: System.Reflection.AssemblyProduct("Protok · Airport Ops Agentic OS")]
[assembly: System.Reflection.AssemblyDescription("Portable launcher for the Protok simulation")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

static class Launcher
{
    [STAThread]
    static int Main()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string page = Path.Combine(dir, "Protok.html");
        if (!File.Exists(page))
        {
            MessageBox.Show("Protok.html was not found next to Protok.exe.\n\nKeep both files in the same folder.", "Protok", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        string url = new Uri(page).AbsoluteUri;

        string browser = FindBrowser();
        if (browser != null)
        {
            try
            {
                var psi = new ProcessStartInfo(browser, "--app=\"" + url + "\" --window-size=1480,940 --no-first-run --no-default-browser-check");
                psi.UseShellExecute = false;
                Process.Start(psi);
                return 0;
            }
            catch { /* fall through to the default browser */ }
        }
        try
        {
            Process.Start(new ProcessStartInfo(page) { UseShellExecute = true });
            return 0;
        }
        catch (Exception e)
        {
            MessageBox.Show("Could not open a browser.\n\nOpen Protok.html by hand in Edge, Chrome or Firefox.\n\n" + e.Message, "Protok", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 2;
        }
    }

    static string FindBrowser()
    {
        string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string pf = Environment.GetEnvironmentVariable("ProgramW6432") ?? Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] candidates =
        {
            AppPath("msedge.exe"),
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(local, @"Microsoft\Edge\Application\msedge.exe"),
            AppPath("chrome.exe"),
            Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe"),
            AppPath("brave.exe"),
            Path.Combine(pf, @"BraveSoftware\Brave-Browser\Application\brave.exe"),
        };
        foreach (string c in candidates)
            if (!string.IsNullOrEmpty(c) && File.Exists(c)) return c;
        return null;
    }

    static string AppPath(string exe)
    {
        foreach (RegistryKey hive in new[] { Registry.CurrentUser, Registry.LocalMachine })
        {
            try
            {
                using (RegistryKey k = hive.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + exe))
                {
                    string v = k == null ? null : k.GetValue(null) as string;
                    if (!string.IsNullOrEmpty(v)) return v.Trim('"');
                }
            }
            catch { }
        }
        return null;
    }
}
