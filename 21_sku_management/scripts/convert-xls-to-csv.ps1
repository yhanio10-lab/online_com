param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputPath
)

$excel = $null
$workbook = $null
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $workbook = $excel.Workbooks.Open($InputPath)
  $sheet = $workbook.Worksheets.Item(1)
  $used = $sheet.UsedRange
  $rows = $used.Rows.Count
  $cols = $used.Columns.Count
  $lines = New-Object System.Collections.Generic.List[string]

  for ($r = 1; $r -le $rows; $r++) {
    $values = @()
    for ($c = 1; $c -le $cols; $c++) {
      $text = [string]$sheet.Cells.Item($r, $c).Text
      $escaped = $text.Replace('"', '""')
      $values += '"' + $escaped + '"'
    }
    $lines.Add(($values -join ','))
  }

  [System.IO.File]::WriteAllLines($OutputPath, $lines, [System.Text.UTF8Encoding]::new($false))
}
finally {
  if ($workbook) { $workbook.Close($false) | Out-Null }
  if ($excel) { $excel.Quit() | Out-Null }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
