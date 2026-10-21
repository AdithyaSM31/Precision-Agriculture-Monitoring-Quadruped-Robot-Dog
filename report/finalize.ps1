# Inserts the Contents, List of Figures and List of Tables as explicit TOC fields,
# updates every field, and saves the final .docx and .pdf.
#   Contents        TOC \o "1-3" \h \z \u        (Heading 1-3)
#   List of Figures TOC \h \z \t "Figure Caption,1"   (caption style only)
#   List of Tables  TOC \h \z \t "Table Caption,1"
param([string]$Doc)
$pdf = [System.IO.Path]::ChangeExtension($Doc, ".pdf")
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$d = $w.Documents.Open($Doc)
function Place($marker, $code) {
  $r = $d.Content
  if ($r.Find.Execute($marker)) {
    $r.Text = ""
    $null = $d.Fields.Add($r, -1, $code, $false)
  } else { Write-Output "marker not found: $marker" }
}
Place "[[TOC]]" 'TOC \o "1-3" \h \z \u'
Place "[[LOF]]" 'TOC \h \z \t "Figure Caption,1"'
Place "[[LOT]]" 'TOC \h \z \t "Table Caption,1"'
# contents styling: chapter-level entries bold with a little space above
$toc1 = $d.Styles.Item("TOC 1"); $toc1.Font.Bold = $true; $toc1.ParagraphFormat.SpaceBefore = 6
$null = $d.Fields.Update()
foreach ($t in $d.TablesOfContents) { $null = $t.Update() }
$d.Save()
$pages = $d.ComputeStatistics(2)
$d.SaveAs2($pdf, 17)
$d.Close($false)
$w.Quit()
Write-Output "pages: $pages"
