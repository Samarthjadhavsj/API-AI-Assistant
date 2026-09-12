Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;

public class NativeMethods {
    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsZoomed(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")]
    public static extern IntPtr GetParent(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    public delegate bool WNDENUMPROC(IntPtr hWnd, int lParam);
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool EnumWindows(WNDENUMPROC lpEnumFunc, int lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left; public int Top; public int Right; public int Bottom;
    }

    // Find all top-level windows belonging to a given PID
    public static List<IntPtr> FindWindowsByPid(int targetPid) {
        List<IntPtr> results = new List<IntPtr>();
        EnumWindows(delegate(IntPtr hWnd, int lParam) {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if ((int)pid == targetPid) {
                results.Add(hWnd);
            }
            return true;
        }, 0);
        return results;
    }
}
"@

# Helper constants
$GWL_EXSTYLE   = -20
$WS_EX_TOPMOST = 0x00000008

function Get-MainFrankWindow {
    $frankProcs = Get-Process -Name "frank" -ErrorAction SilentlyContinue
    if ($null -eq $frankProcs) {
        Write-Error "No 'frank' process found. Ensure the app is running."
        exit 1
    }
    # Search each frank process for a top-level window
    foreach ($p in $frankProcs) {
        $windows = [NativeMethods]::FindWindowsByPid($p.Id)
        foreach ($h in $windows) {
            $sb = New-Object System.Text.StringBuilder 512
            [void][NativeMethods]::GetClassName($h, $sb, 512)
            $cls = $sb.ToString()
            $sb2 = New-Object System.Text.StringBuilder 512
            [void][NativeMethods]::GetWindowText($h, $sb2, 512)
            $ttl = $sb2.ToString()
            Write-Host "  Found: HWND=0x$([String]::Format('{0:X8}', $h.ToInt64())) PID=$($p.Id) Class='$cls' Title='$ttl' Visible=$([NativeMethods]::IsWindowVisible($h))"
            # Pick the first window that has a title or is a Chrome_WidgetWin class (WebView2)
            if ($ttl.Length -gt 0 -or $cls -like '*Chrome*' -or $cls -like '*Tauri*' -or $cls -like '*Window*') {
                Write-Host "  => Selected this window"
                return [IntPtr]$h
            }
        }
    }
    # Fallback: just return the first window of the first frank process that has any windows
    foreach ($p in $frankProcs) {
        $windows = [NativeMethods]::FindWindowsByPid($p.Id)
        if ($windows.Count -gt 0) {
            Write-Host "  => Fallback: using first window HWND=0x$([String]::Format('{0:X8}', $windows[0].ToInt64()))"
            return [IntPtr]$windows[0]
        }
    }
    Write-Error "Frank process(es) found but no top-level windows. The window may not be created yet. Try showing it first via tray or hotkey."
    exit 1
}

function Show-Info {
    param([IntPtr]$hwnd)
    Write-Host "\n--- Window handle (HWND) ------------------------------------"
    Write-Host "HWND: 0x{0:X}" -f $hwnd.ToInt64()
    $tid = [NativeMethods]::GetWindowThreadProcessId($hwnd, [ref]$pid)
    Write-Host "\n--- Process / thread ---------------------------------------"
    Write-Host "Process ID   : $pid"
    Write-Host "Window Thread: $tid"
    $winVisible = [NativeMethods]::IsWindowVisible($hwnd)
    Write-Host "\n--- Visibility --------------------------------------------"
    Write-Host "IsWindowVisible (raw) : $winVisible"
    $rect = New-Object NativeMethods+RECT
    $gotRect = [NativeMethods]::GetWindowRect($hwnd, [ref]$rect)
    if (-not $gotRect) { Write-Error "GetWindowRect failed." }
    $width  = $rect.Right  - $rect.Left
    $height = $rect.Bottom - $rect.Top
    Write-Host "\n--- Geometry ----------------------------------------------"
    Write-Host "Left   : $($rect.Left)"
    Write-Host "Top    : $($rect.Top)"
    Write-Host "Right  : $($rect.Right)"
    Write-Host "Bottom : $($rect.Bottom)"
    Write-Host "Width  : $width"
    Write-Host "Height : $height"
    $isWin = [NativeMethods]::IsWindow($hwnd)
    Write-Host "\n--- Window existence ---------------------------------------"
    Write-Host "IsWindow : $isWin"
    $iconic = [NativeMethods]::IsIconic($hwnd)
    Write-Host "\n--- Min/Max state ----------------------------------------"
    Write-Host "IsIconic (minimized) : $iconic"
    $zoomed = [NativeMethods]::IsZoomed($hwnd)
    Write-Host "IsZoomed (maximized) : $zoomed"
    $fg = [NativeMethods]::GetForegroundWindow()
    Write-Host "\n--- Foreground window --------------------------------------"
    Write-Host "Foreground HWND : 0x{0:X}" -f $fg.ToInt64()
    Write-Host "Is our window foreground? " ($fg -eq $hwnd)
    Add-Type -AssemblyName System.Windows.Forms
    $primary = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $insidePrimary = (
    $rect.Left   -ge $primary.Left -and
    $rect.Top    -ge $primary.Top  -and
    $rect.Right  -le $primary.Right -and
    $rect.Bottom -le $primary.Bottom
)
    Write-Host "\n--- Monitor positioning -----------------------------------"
    Write-Host "Primary monitor bounds: Left=$($primary.Left) Top=$($primary.Top) Right=$($primary.Right) Bottom=$($primary.Bottom)"
    Write-Host "Window fully inside primary monitor? $insidePrimary"
    $outside = -not $insidePrimary
    Write-Host "Is any part outside primary monitor? $outside"
    $exStyle = [NativeMethods]::GetWindowLong($hwnd, $GWL_EXSTYLE)
    $topMost = ($exStyle -band $WS_EX_TOPMOST) -ne 0
    Write-Host "\n--- Always‑on‑top ----------------------------------------"
    Write-Host "WS_EX_TOPMOST flag set? $topMost"
    Write-Host "\n--- Final state -------------------------------------------"
    Write-Host "Visible?      $winVisible"
    Write-Host "Top‑most?     $topMost"
    Write-Host "Focused?      $($fg -eq $hwnd)"
}

$hwnd = Get-MainFrankWindow
Show-Info -hwnd $hwnd
