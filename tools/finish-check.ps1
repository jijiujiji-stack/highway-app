git status
git diff --check
Select-String -Path app.js,index.html,style.css -Pattern "鬥|鬮|竊|繝"
git diff --cached --name-only

Remove-Item diff.txt -ErrorAction SilentlyContinue
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
git --no-pager diff -- app.js style.css index.html PROJECT_HANDOFF.md CLAUDE.md | Out-File -FilePath diff.txt -Encoding utf8

[console]::beep(800,300)
[console]::beep(1000,300)
[console]::beep(1200,500)
