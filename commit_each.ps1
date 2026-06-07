# Powershell script to stage and commit each file one-by-one

$files = git status --porcelain | ForEach-Object {
    $line = $_.ToString()
    # Path is after the 3-character prefix (e.g. '?? ', ' M ')
    $path = $line.Substring(3).Trim()
    # Remove surrounding quotes if git added them (happens if paths have special chars/spaces)
    $path = $path.Replace('"', '')
    $path
}

$count = $files.Count
Write-Host "Found $count files to commit one-by-one."

$i = 1
foreach ($file in $files) {
    if (-not $file) { continue }
    Write-Host "[$i/$count] Processing: $file"
    
    git add $file
    
    # Custom commit message based on file path
    $commitMsg = "feat: add $file"
    if ($file -match "gitignore") {
        $commitMsg = "chore: add $file"
    } elseif ($file -match "config" -or $file -match "tsconfig" -or $file -match "package.json" -or $file -match "package-lock.json") {
        $commitMsg = "chore: add $file config"
    } elseif ($file -match "test") {
        $commitMsg = "test: add $file"
    }
    
    git commit -m $commitMsg
    $i++
}

Write-Host "All files committed individually successfully!"
