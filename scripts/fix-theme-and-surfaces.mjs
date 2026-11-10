import fs from 'node:fs'

// Helper to preserve CRLF / LF
function updateFile(filePath, updater) {
  let content = fs.readFileSync(filePath, 'utf8')
  const isCRLF = content.includes('\r\n')
  content = content.replace(/\r\n/g, '\n')
  content = updater(content)
  if (isCRLF) {
    content = content.replace(/\n/g, '\r\n')
  }
  fs.writeFileSync(filePath, content, 'utf8')
  console.log(`Updated ${filePath}`)
}

// 1. Update src/App.tsx
updateFile('src/App.tsx', (content) => {
  // Add class="dark" toggle to html alongside dataset.theme
  content = content.replace(
    /  useEffect\(\(\) => \{\n    document\.documentElement\.dataset\.theme = theme\n    localStorage\.setItem\("synra-theme", theme\)\n  \}, \[theme\]\)/,
    `  useEffect(() => {
    document.documentElement.dataset.theme = theme
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    localStorage.setItem("synra-theme", theme)
  }, [theme])`
  )

  // Ensure notification button closes profile menu
  content = content.replace(
    'onClick={() => setNotificationOpen(true)}',
    'onClick={() => { setProfileMenuOpen(false); setNotificationOpen(true) }}'
  )

  return content
})

// 2. Update src/index.css
updateFile('src/index.css', (content) => {
  // Update custom-variant dark
  content = content.replace(
    /@custom-variant dark \(& :is\(.*?\)\);|@custom-variant dark \([^)]+\);/,
    '@custom-variant dark (&:is([data-theme="dark"] *, [data-theme="dark"], .dark *, .dark));'
  )

  const solidRules = `
/* ── Permukaan Solid Opaque (100% Alpha 1) ── */
.bg-card,
[data-slot="card"],
[data-slot="sheet-content"],
[data-slot="alert-dialog-content"] {
  background-color: var(--card) !important;
  color: var(--card-foreground);
}

.bg-popover,
[data-slot="select-content"],
[data-slot="dropdown-menu-content"],
.nav-dropdown,
.profile-dropdown,
.mobile-menu__panel {
  background-color: var(--popover) !important;
  color: var(--popover-foreground);
}

.border-border,
[data-slot="card"],
[data-slot="sheet-content"],
[data-slot="alert-dialog-content"],
[data-slot="select-content"],
[data-slot="dropdown-menu-content"] {
  border-color: var(--border);
}
`

  if (!content.includes('/* ── Permukaan Solid Opaque')) {
    content = content.replace(
      /\/\* ── Skala Tipografi Standar SYNRA/,
      `${solidRules}\n/* ── Skala Tipografi Standar SYNRA`
    )
  }

  return content
})
