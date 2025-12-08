    // Check for token in URL (from Google Auth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      localStorage.setItem('auth_token', token);
      // Remove token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@3.2.3/dist/dexie.mjs'
    import 'https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js'
    const md = new window.markdownit({
      html: true,
      breaks: true,
      linkify: true,
      typographer: true
    })
    
    // Allow attachment: protocol
    const defaultValidate = md.validateLink;
    md.validateLink = function (url) {
        if (url.startsWith('attachment:')) return true;
        return defaultValidate(url);
    }

    // Monkey-patch render to auto-convert multi-line inline code to code blocks
    const _originalRender = md.render.bind(md)
    md.render = function(src, env) {
      const preprocessed = (src || '').replace(/`([^`]+)`/g, (match, code) => {
        if (code.includes('\n')) return '\n```\n' + code + '\n```\n'
        return match
      })
      return _originalRender(preprocessed, env)
    }

    // --- Database Setup ---
    const db = new Dexie('NotesAppDB')
    db.version(1).stores({ notes: 'id,title,updated_at,created_at,favorite' })
    db.version(2).stores({
        notes: 'id,title,updated_at,created_at,favorite',
        attachments: 'id,note_id,filename,data'
    })
    window.db = db; // Expose for other scripts

    window.updatePreview = async (text) => {
        try {
            // Pre-process attachment links to avoid markdown-it sanitization issues
            // Replace ![alt](attachment:id) with a placeholder image
            // Also handle cases where the alt text might be empty or different
            let processedText = (text || '').replace(/!\[(.*?)\]\(attachment:(.*?)\)/g, (match, alt, id) => {
                console.log('Found attachment ref:', id);
                return `<img data-attachment-id="${id}" alt="${alt}" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMzMzMiLz48L3N2Zz4=" class="loading-attachment" style="max-width:100%">`;
            });

            console.log('Updating preview with text length:', processedText.length);
            const html = md.render(processedText)
            
            const previewEl = document.getElementById('preview');
            if (previewEl) {
                previewEl.innerHTML = html
                
                // Resolve attachments
                const imgs = previewEl.querySelectorAll('img[data-attachment-id]')
                console.log(`Found ${imgs.length} attachment placeholders to resolve`);
                
                for (const img of imgs) {
                    const id = img.getAttribute('data-attachment-id')
                    try {
                        const att = await db.attachments.get(id)
                        if (att && att.data) {
                            console.log('Loaded data for attachment:', id);
                            img.src = att.data
                            img.classList.remove('loading-attachment')
                        } else {
                            console.warn('Attachment data not found for:', id);
                            img.alt = 'Attachment not found'
                            img.src = '' // Clear placeholder
                        }
                    } catch (e) {
                        console.error('Error loading attachment', e)
                    }
                }
            }
        } catch (err) {
            console.error('Error in updatePreview:', err);
        }
    }
    
    // Expose helper for external scripts
    setTimeout(() => {
        if (typeof insertFormatting === 'function') {
            window.insertFormatting = insertFormatting;
        }
    }, 0);


    // --- DOM Elements ---
    const statusBar = document.getElementById('status-bar')
    const preview = document.getElementById('preview')
    const notesList = document.getElementById('notes-list')
    const rightNotesList = document.getElementById('right-notes-list')
    const titleInput = document.getElementById('note-title')
    const searchInput = document.getElementById('search-input')
    const backlinksContainer = document.getElementById('backlinks')
    
    // --- State ---
    let cmView = null
    let currentNote = null
    let saveTimer = null
    let currentTab = 'notes'
    let currentRightTab = 'backlinks'

    // --- Core Data Functions ---
    async function saveNoteToDB(note) {
      note.updated_at = new Date().toISOString()
      if (!note.id) note.id = `local-${Date.now()}`
      // preserve favorite status if not specified
      if (note.favorite === undefined && currentNote && currentNote.favorite !== undefined) {
        note.favorite = currentNote.favorite
      }
      await db.notes.put(note)
      return note
    }

    async function getNoteById(id) {
      return db.notes.get(id)
    }

    async function getAllNotes() {
      return db.notes.orderBy('updated_at').reverse().toArray()
    }

    // --- UI Update Functions ---
    async function loadNotesList() {
      const notes = await getAllNotes()
      const searchQuery = searchInput.value.toLowerCase().trim()
      
      // 1. Handle Left Sidebar (Notes, Favorites, Tags, AND Mobile Tabs)
      let leftFiltered = notes
      
      // If we are in a "Right Tab" mode but on mobile (where it's rendered in left sidebar)
      // We need to handle it here.
      // Note: currentTab is updated by the click handler below.
      
      if (searchQuery) {
        leftFiltered = notes.filter(n => (n.title||'').toLowerCase().includes(searchQuery) || (n.body||'').toLowerCase().includes(searchQuery))
        renderNotesList(leftFiltered, notesList)
      } else {
        // Standard Tabs
        if (currentTab === 'notes') {
            leftFiltered = notes.filter(n => !n.status || n.status === 'active')
            renderNotesList(leftFiltered, notesList)
        } else if (currentTab === 'favorites') {
            leftFiltered = notes.filter(n => (!n.status || n.status === 'active') && n.favorite)
            renderNotesList(leftFiltered, notesList)
        } else if (currentTab === 'tags') {
            // Tag Logic
            const tagMap = new Map()
            // Filter active notes for tags
            const activeNotes = notes.filter(n => !n.status || n.status === 'active')
            activeNotes.forEach(n => {
              const tags = (n.body || '').match(/#[a-zA-Z0-9_]+/g) || []
              tags.forEach(t => {
                if (!tagMap.has(t)) tagMap.set(t, [])
                tagMap.get(t).push(n)
              })
            })
            
            if (tagMap.size === 0) {
              notesList.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:13px;text-align:center">No tags found</div>`
            } else {
              notesList.innerHTML = Array.from(tagMap.entries()).map(([tag, taggedNotes]) => `
                <div style="margin-bottom:8px">
                  <div style="padding:4px 12px;font-size:12px;color:var(--accent-secondary);font-weight:600">${tag} (${taggedNotes.length})</div>
                  ${taggedNotes.map(n => renderNoteItem(n)).join('')}
                </div>
              `).join('')
            }
        } 
        // Mobile Tabs Logic (Rendered in Left Sidebar on Mobile)
        else if (currentTab === 'archive') {
            leftFiltered = notes.filter(n => n.status === 'archived')
            renderNotesList(leftFiltered, notesList)
        } else if (currentTab === 'trash') {
            leftFiltered = notes.filter(n => n.status === 'trash')
            renderNotesList(leftFiltered, notesList)
        } else if (currentTab === 'backlinks') {
            // For mobile backlinks, we might want to render them in the list area
            // But updateBacklinks() targets a specific container.
            // Let's just render a placeholder or reuse the logic.
            // Actually, let's render the backlinks into the notesList container for mobile consistency.
            notesList.innerHTML = '' // Clear
            // We can reuse updateBacklinks but target notesList? 
            // Or just manually call it and move content?
            // Simpler: Just show a message that backlinks are for the current note
            if (!currentNote) {
                 notesList.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:13px;text-align:center">Select a note to see backlinks</div>`
            } else {
                 // We need to fetch backlinks and render them here
                 const currentTitle = currentNote.title.trim().toLowerCase()
                 const links = notes.filter(n => n.id !== currentNote.id && (n.body||'').toLowerCase().includes(currentTitle))
                 if (links.length === 0) {
                    notesList.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:13px;text-align:center">No backlinks found</div>`
                 } else {
                    renderNotesList(links, notesList)
                 }
            }
        }
      }

      // 2. Handle Right Sidebar (Desktop Only)
      const backlinksContainer = document.getElementById('backlinks')
      const rightList = document.getElementById('right-notes-list')

      if (currentRightTab === 'backlinks') {
        backlinksContainer.style.display = 'block'
        rightList.style.display = 'none'
        updateBacklinks()
      } else {
        backlinksContainer.style.display = 'none'
        rightList.style.display = 'block'
        
        let rightFiltered = []
        if (currentRightTab === 'archive') {
            rightFiltered = notes.filter(n => n.status === 'archived')
        } else if (currentRightTab === 'trash') {
            rightFiltered = notes.filter(n => n.status === 'trash')
        }
        renderNotesList(rightFiltered, rightList)
      }
    }

    function renderNoteItem(n) {
      const isActive = currentNote && currentNote.id === n.id ? 'active' : ''
      const date = new Date(n.updated_at).toLocaleDateString()
      const previewText = (n.body || '').slice(0, 60).replace(/\n/g, ' ') + '...'
      return `
        <div class="note-item ${isActive}" data-id="${n.id}">
          <div class="note-item-title">${n.title || 'Untitled'}</div>
          <div class="note-item-preview">${previewText}</div>
          <div class="note-item-meta">
            <span>${date}</span>
            ${n.favorite ? '<span>★</span>' : ''}
          </div>
        </div>`
    }

    function renderNotesList(notes, container) {
      if (notes.length === 0) {
        container.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:13px;text-align:center">No notes found</div>`
        return
      }
      container.innerHTML = notes.map(n => renderNoteItem(n)).join('')
    }

    async function updateBacklinks() {
      if (!currentNote || !currentNote.title || !currentNote.title.trim()) {
        backlinksContainer.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px">No backlinks</div>'
        return
      }
      
      try {
        const notes = await getAllNotes()
        const currentTitle = currentNote.title.trim().toLowerCase()
        
        // Find notes that mention the current note's title
        const links = notes.filter(n => {
          if (n.id === currentNote.id) return false
          const body = (n.body || '').toLowerCase()
          // Simple inclusion check
          return body.includes(currentTitle)
        })
        
        if (links.length === 0) {
          backlinksContainer.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px">No backlinks found</div>'
        } else {
          backlinksContainer.innerHTML = links.map(n => {
             // Find snippet of text around the match
             const bodyLower = (n.body || '').toLowerCase()
             const idx = bodyLower.indexOf(currentTitle)
             let snippet = ''
             if (idx !== -1) {
                const start = Math.max(0, idx - 20)
                const end = Math.min(bodyLower.length, idx + currentTitle.length + 20)
                snippet = (n.body || '').substring(start, end)
                if (start > 0) snippet = '...' + snippet
                if (end < bodyLower.length) snippet = snippet + '...'
             } else {
                snippet = (n.body || '').substring(0, 40) + '...'
             }
             
             return `
              <div class="note-item" data-id="${n.id}" style="margin-bottom:8px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;cursor:pointer;border:1px solid transparent;transition:all 0.2s">
                <div class="note-item-title" style="font-size:13px;font-weight:600;color:var(--text-main);margin-bottom:4px">${n.title || 'Untitled'}</div>
                <div class="note-item-preview" style="font-size:11px;color:var(--text-muted);line-height:1.4">${snippet}</div>
              </div>
            `
          }).join('')
          
          // Add hover effect via JS since inline styles are limited
          backlinksContainer.querySelectorAll('.note-item').forEach(el => {
             el.addEventListener('mouseenter', () => el.style.borderColor = 'var(--accent-primary)')
             el.addEventListener('mouseleave', () => el.style.borderColor = 'transparent')
          })
        }
      } catch (err) {
        console.error('Error updating backlinks:', err)
        backlinksContainer.innerHTML = '<div style="padding:12px;color:red;font-size:12px">Error loading backlinks</div>'
      }
    }

    function debounceSave(fn, delay=900) {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(fn, delay)
    }

    // --- Editor Logic ---
    
    // Helper to insert text at cursor or wrap selection
    function insertFormatting(before, after = '') {
      if (cmView) {
        // CodeMirror
        const state = cmView.state
        const range = state.selection.main
        const selectedText = state.sliceDoc(range.from, range.to)
        const newText = before + selectedText + after
        
        cmView.dispatch({
          changes: { from: range.from, to: range.to, insert: newText },
          selection: { anchor: range.from + before.length + selectedText.length }
        })
        cmView.focus()
      } else {
        // Fallback Textarea
        const ta = document.getElementById('editor-fallback')
        if (!ta) return
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const text = ta.value
        const selectedText = text.substring(start, end)
        const newText = before + selectedText + after
        
        ta.value = text.substring(0, start) + newText + text.substring(end)
        ta.selectionStart = ta.selectionEnd = start + before.length + selectedText.length
        ta.focus()
        // Trigger input event to update preview
        ta.dispatchEvent(new Event('input'))
      }
    }

    // Initialize Editor
    (async function initEditor(){
      try {
        // Dynamic imports for CodeMirror
        const stateUrl = 'https://esm.sh/@codemirror/state@6.4.1?target=es2020'
        const viewUrl = 'https://esm.sh/@codemirror/view@6.23.0?target=es2020&deps=@codemirror/state@6.4.1'
        const markdownUrl = 'https://esm.sh/@codemirror/lang-markdown@6.2.3?target=es2020&deps=@codemirror/state@6.4.1,@codemirror/view@6.23.0'
        const basicSetupUrl = 'https://esm.sh/@codemirror/basic-setup@0.20.0?target=es2020&deps=@codemirror/state@6.4.1,@codemirror/view@6.23.0'
        const themeUrl = 'https://esm.sh/@codemirror/theme-one-dark@6.0.0?target=es2020&deps=@codemirror/state@6.4.1,@codemirror/view@6.23.0'

        const [stateMod, viewMod, markdownMod, basicSetupMod, themeMod] = await Promise.all([
          import(stateUrl),
          import(viewUrl),
          import(markdownUrl),
          import(basicSetupUrl),
          import(themeUrl)
        ])

        const EditorState = stateMod.EditorState || stateMod.default?.EditorState || stateMod.default
        const EditorView = viewMod.EditorView || viewMod.default?.EditorView || viewMod.default
        const markdownExtensionFactory = markdownMod.markdown || markdownMod.default
        const basicSetupExport = basicSetupMod.basicSetup || basicSetupMod.default
        const oneDark = themeMod.oneDark || themeMod.default

        if (!EditorView || !EditorState || !markdownExtensionFactory || !basicSetupExport) {
          throw new Error('CodeMirror modules failed to load')
        }

        const resolvedBasicSetup = typeof basicSetupExport === 'function' ? basicSetupExport() : basicSetupExport
        const extensions = []
        if (Array.isArray(resolvedBasicSetup)) extensions.push(...resolvedBasicSetup)
        else if (resolvedBasicSetup) extensions.push(resolvedBasicSetup)
        const mdExtension = typeof markdownExtensionFactory === 'function' ? markdownExtensionFactory() : markdownExtensionFactory
        if (mdExtension) extensions.push(mdExtension)
        if (oneDark) extensions.push(oneDark)

        const startState = EditorState.create({ doc: '', extensions })

        const cmRoot = document.getElementById('cm-root')
        cmRoot.style.display = 'block'
        document.getElementById('editor-fallback').style.display = 'none'

        cmView = new EditorView({ state: startState, parent: cmRoot })
        window.cmView = cmView

        // Change Handler
        const originalDispatch = cmView.dispatch.bind(cmView)
        cmView.dispatch = (tr) => {
          originalDispatch(tr)
          if (tr.docChanged) {
            if (window.__isDeleting) return
            const text = cmView.state.doc.toString()
            if (window.updatePreview) window.updatePreview(text || '')
            else preview.innerHTML = md.render(text || '')
            statusBar.textContent = 'Editing...'
            debounceSave(async ()=> {
              if (!currentNote) return
              const note = {
                id: currentNote.id,
                title: titleInput.value || 'Untitled',
                body: cmView.state.doc.toString() || '',
                created_at: currentNote.created_at || new Date().toISOString(),
                favorite: currentNote.favorite || false,
                status: currentNote.status || 'active'
              }
              const saved = await saveNoteToDB(note)
              currentNote = saved
              statusBar.textContent = 'Saved'
              loadNotesList()
            })
          }
        }

        console.info('Rich editor initialized')
      } catch (err) {
        console.warn('Rich editor failed, using fallback', err)
        enableFallbackEditor()
      }
      
      // Load profile avatar
      const storedAvatar = localStorage.getItem('profile_avatar')
      const storedName = localStorage.getItem('profile_name') || 'Demo User'
      const avatarEl = document.getElementById('header-avatar')
      
      if (avatarEl) {
        if (storedAvatar) {
          avatarEl.style.backgroundImage = `url('${storedAvatar}')`
          avatarEl.textContent = ''
          avatarEl.style.backgroundSize = 'cover'
          avatarEl.style.backgroundPosition = 'center'
        } else {
          const initials = (storedName.trim() || 'Demo User')
            .split(' ')
            .filter(n => n)
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
          
          avatarEl.style.backgroundImage = 'none'
          avatarEl.textContent = initials
        }
      }

      // Initial Load
      await loadNotesList()
      createNewNote()
    })();

    function enableFallbackEditor() {
      const cmRoot = document.getElementById('cm-root')
      const ta = document.getElementById('editor-fallback')
      cmRoot.style.display = 'none'
      ta.style.display = 'block'

      ta.addEventListener('input', ()=> {
        if (window.updatePreview) window.updatePreview(ta.value || '')
        else preview.innerHTML = md.render(ta.value || '')
        statusBar.textContent = 'Editing...'
        debounceSave(async ()=>{
          const note = {
            id: currentNote?.id || `local-${Date.now()}`,
            title: titleInput.value || 'Untitled',
            body: ta.value || '',
            created_at: currentNote?.created_at || new Date().toISOString(),
            favorite: currentNote?.favorite || false
          }
          const saved = await saveNoteToDB(note)
          currentNote = saved
          statusBar.textContent = 'Saved'
          loadNotesList()
        }, 700)
      })
    }

    function loadNoteIntoEditor(note) {
      currentNote = note
      titleInput.value = note.title || ''
      const body = note.body || ''
      
      if (cmView) {
        cmView.dispatch({ changes: { from: 0, to: cmView.state.doc.length, insert: body } })
      } else {
        const ta = document.getElementById('editor-fallback')
        ta.value = body
      }
      if (window.updatePreview) window.updatePreview(body)
      else preview.innerHTML = md.render(body)
      statusBar.textContent = 'Loaded'
      window.__currentNoteId = note.id
      
      // Update Favorite Button
      const favBtn = document.getElementById('btn-favorite')
      if (favBtn) {
        favBtn.style.color = note.favorite ? 'var(--accent-primary)' : 'var(--text-muted)'
      }

      updateBacklinks()
      
      // Highlight in list
      document.querySelectorAll('.note-item').forEach(el => el.classList.remove('active'))
      const activeItem = document.querySelector(`.note-item[data-id="${note.id}"]`)
      if (activeItem) activeItem.classList.add('active')
    }

    function createNewNote() {
      const newNote = { id: `local-${Date.now()}`, title:'', body:'', created_at: new Date().toISOString(), favorite: false }
      loadNoteIntoEditor(newNote)
      // Focus title
      titleInput.focus()
    }

    // --- Event Listeners ---

    // 1. Sidebar Tabs
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab
        
        // Determine if this is a left or right tab
        // On mobile, ALL tabs are in the left sidebar (via .mobile-tab class)
        // So we need to check if the clicked element is actually inside the rightbar or sidebar
        const isRightbarClick = tab.closest('.rightbar') !== null
        
        if (isRightbarClick) {
            // Desktop Right Sidebar Click
            document.querySelectorAll('.rightbar .sidebar-tab').forEach(t => t.classList.remove('active'))
            tab.classList.add('active')
            currentRightTab = tabName
        } else {
            // Left Sidebar Click (Desktop or Mobile)
            document.querySelectorAll('.sidebar .sidebar-tab').forEach(t => t.classList.remove('active'))
            tab.classList.add('active')
            currentTab = tabName
            
            // On mobile, close sidebar after selection (optional, but good UX)
            // if (window.innerWidth <= 900) {
            //     const sb = document.querySelector('.sidebar')
            //     const ov = document.getElementById('sidebar-overlay')
            //     if (sb) sb.classList.remove('open')
            //     if (ov) ov.classList.remove('show')
            // }
        }

        loadNotesList()
      })
    })

    // 2. Note Selection (Left List)
    notesList.addEventListener('click', async (ev) => {
      const item = ev.target.closest('.note-item')
      if (!item) return
      const id = item.dataset.id
      const note = await getNoteById(id)
      if (note) {
        loadNoteIntoEditor(note)
        // Close sidebar on mobile when a note is selected
        if (window.innerWidth <= 900) {
            const sb = document.querySelector('.sidebar')
            const ov = document.getElementById('sidebar-overlay')
            if (sb) sb.classList.remove('open')
            if (ov) ov.classList.remove('show')
        }
      }
    })
    
    // 2b. Note Selection (Right List - Archive/Trash)
    rightNotesList.addEventListener('click', async (ev) => {
      const item = ev.target.closest('.note-item')
      if (!item) return
      const id = item.dataset.id
      const note = await getNoteById(id)
      if (note) loadNoteIntoEditor(note)
    })
    
    // 3. Backlink Selection
    backlinksContainer.addEventListener('click', async (ev) => {
      const item = ev.target.closest('.note-item')
      if (!item) return
      const id = item.dataset.id
      const note = await getNoteById(id)
      if (note) loadNoteIntoEditor(note)
    })

    // 4. Search
    searchInput.addEventListener('input', async (ev) => {
      loadNotesList()
    })

    // 5. Formatting Toolbar
    const formatBtns = document.querySelectorAll('.format-btn')

    function toggleHeader(level) {
      const prefix = '#'.repeat(level) + ' '
      if (cmView) {
        const state = cmView.state
        const { from } = state.selection.main
        const line = state.doc.lineAt(from)
        const lineText = line.text
        
        // Regex to find existing header at start of line (allowing whitespace)
        const match = lineText.match(/^(\s*)(#+)(\s+)?/)
        
        if (match) {
            const fullMatch = match[0]
            const currentLevel = match[2].length
            const hasSpace = !!match[3]
            
            if (currentLevel === level && hasSpace) {
                // Same level, remove it (toggle off)
                cmView.dispatch({
                    changes: { from: line.from, to: line.from + fullMatch.length, insert: match[1] } 
                })
            } else {
                // Different level or malformed, replace with new level
                cmView.dispatch({
                    changes: { from: line.from, to: line.from + fullMatch.length, insert: match[1] + prefix }
                })
            }
        } else {
            // No header, add it
            cmView.dispatch({
                changes: { from: line.from, to: line.from, insert: prefix }
            })
        }
        cmView.focus()
      } else {
        // Fallback for textarea
        const ta = document.getElementById('editor-fallback')
        if (!ta) return
        const start = ta.selectionStart
        const text = ta.value
        let lineStart = text.lastIndexOf('\n', start - 1) + 1
        if (lineStart < 0) lineStart = 0
        
        const currentLine = text.substring(lineStart).split('\n')[0]
        if (currentLine.startsWith(prefix)) {
             ta.setRangeText('', lineStart, lineStart + prefix.length, 'end')
        } else {
             ta.setRangeText(prefix, lineStart, lineStart, 'end')
        }
        ta.dispatchEvent(new Event('input'))
      }
    }

    function toggleCode() {
       if (cmView) {
         const state = cmView.state
         const range = state.selection.main
         const selectedText = state.sliceDoc(range.from, range.to)
         const line = state.doc.lineAt(range.from)
         const isLineEmpty = line.text.trim() === ''
         
         if (selectedText.includes('\n') || (selectedText === '' && isLineEmpty)) {
            const text = `\`\`\`\n${selectedText}\n\`\`\``
            cmView.dispatch({ 
                changes: { from: range.from, to: range.to, insert: text },
                selection: { anchor: range.from + 4 }
            })
         } else {
            insertFormatting('`', '`')
         }
         cmView.focus()
       } else {
         insertFormatting('`', '`')
       }
    }

    formatBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.id === 'btn-favorite') {
            if (currentNote) {
                currentNote.favorite = !currentNote.favorite
                btn.style.color = currentNote.favorite ? 'var(--accent-primary)' : 'var(--text-muted)'
                debounceSave(async () => {
                    await saveNoteToDB(currentNote)
                    loadNotesList()
                }, 0)
            }
            return
        }
        const label = btn.textContent.trim()
        switch(label) {
          case 'B': insertFormatting('**', '**'); break;
          case 'I': insertFormatting('*', '*'); break;
          case 'U': insertFormatting('<u>', '</u>'); break;
          case 'H1': toggleHeader(1); break;
          case 'H2': toggleHeader(2); break;
          case 'Code': toggleCode(); break;
        }
      })
    })

    // Archive/Delete Logic
    async function archiveCurrent() {
      if (!currentNote) return
      // Toggle archive status
      if (currentNote.status === 'archived') {
        currentNote.status = 'active'
      } else {
        currentNote.status = 'archived'
      }
      await saveNoteToDB(currentNote)
      loadNotesList()
    }

    async function deleteCurrent() {
      if (!currentNote) return
      
      // Prevent auto-save during transition
      window.__isDeleting = true
      
      if (currentNote.status === 'trash') {
        if (confirm('Permanently delete this note?')) {
            await db.notes.delete(currentNote.id)
            await loadNotesList()
            createNewNote()
        }
      } else {
        currentNote.status = 'trash'
        await saveNoteToDB(currentNote)
        await loadNotesList()
        createNewNote()
      }
      
      setTimeout(() => { window.__isDeleting = false }, 100)
    }

    document.getElementById('btn-archive').addEventListener('click', archiveCurrent)
    document.getElementById('btn-delete').addEventListener('click', deleteCurrent)

    // Attach Image Logic
    const btnAttachImage = document.getElementById('btn-attach-image');
    const fileAttachImage = document.getElementById('file-attach-image');

    if (btnAttachImage && fileAttachImage) {
        btnAttachImage.addEventListener('click', () => {
            fileAttachImage.click();
        });

        fileAttachImage.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                const dataUrl = evt.target.result;
                
                if (window.db) {
                    const id = `att-${Date.now()}`;
                    try {
                        await window.db.attachments.put({
                            id: id,
                            note_id: window.__currentNoteId,
                            filename: file.name,
                            data: dataUrl
                        });
                        console.log('Image attachment saved:', id);
                        insertFormatting(`\n![${file.name}](attachment:${id})\n`);
                        
                        // Force preview update
                        setTimeout(() => {
                             if (window.cmView) {
                                 const text = window.cmView.state.doc.toString();
                                 if (window.updatePreview) window.updatePreview(text);
                             }
                        }, 50);
                    } catch (err) {
                        console.error('Failed to save image attachment', err);
                        alert('Failed to save image to database. Using inline image instead.');
                        insertFormatting(`\n![${file.name}](${dataUrl})\n`);
                    }
                } else {
                    insertFormatting(`\n![${file.name}](${dataUrl})\n`);
                }
                
                // Reset input
                fileAttachImage.value = '';
            };
            reader.readAsDataURL(file);
        });
    }

    // 6. Navbar Buttons
    document.getElementById('btn-new').addEventListener('click', createNewNote)
    
    // Quick Switcher removed as per user request
    // document.getElementById('btn-quickswitch').addEventListener('click', () => { ... })

    document.getElementById('btn-profile').addEventListener('click', () => {
      window.location.href = 'profile.html'
    })

    document.getElementById('btn-settings').addEventListener('click', () => {
      window.location.href = 'settings.html'
    })

    // --- Export Logic ---
    function getNoteTitle() {
       return (titleInput.value || 'note').replace(/[^\w\- ]+/g, '')
    }
    
    function getNoteContent() {
       return cmView ? cmView.state.doc.toString() : document.getElementById('editor-fallback').value
    }

    document.getElementById('btn-export-md').addEventListener('click', () => {
      const content = getNoteContent()
      const filename = getNoteTitle() + '.md'
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      saveAs(blob, filename)
    })

    document.getElementById('btn-export-pdf').addEventListener('click', () => {
      const element = document.getElementById('preview')
      const opt = {
        margin:       10,
        filename:     getNoteTitle() + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(element).save();
    })

    document.getElementById('btn-export-docx').addEventListener('click', async () => {
        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;
        const content = getNoteContent();
        const lines = content.split('\n');
        
        const children = lines.map(line => {
            if (line.startsWith('# ')) {
                return new Paragraph({
                    text: line.replace('# ', ''),
                    heading: HeadingLevel.HEADING_1,
                });
            } else if (line.startsWith('## ')) {
                return new Paragraph({
                    text: line.replace('## ', ''),
                    heading: HeadingLevel.HEADING_2,
                });
            } else {
                return new Paragraph({
                    children: [new TextRun(line)],
                });
            }
        });

        const doc = new Document({
            sections: [{
                properties: {},
                children: children,
            }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, getNoteTitle() + '.docx');
    })

    document.getElementById('btn-export-ppt').addEventListener('click', () => {
        const pptx = new PptxGenJS();
        const slide = pptx.addSlide();
        
        // Title
        slide.addText(titleInput.value || 'Untitled', { x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '363636' });
        
        // Body (Simple dump)
        const content = getNoteContent();
        slide.addText(content, { x: 0.5, y: 1.5, w: '90%', h: '70%', fontSize: 14, color: '363636', valign: 'top' });
        
        pptx.writeFile({ fileName: getNoteTitle() + '.pptx' });
    })

    // --- Import Logic ---
    
    // 1. Text/MD Import (Client-side)
    document.getElementById('btn-import-txt').addEventListener('click', () => {
        document.getElementById('file-import-txt').click()
    })
    
    document.getElementById('file-import-txt').addEventListener('change', (e) => {
        const file = e.target.files[0]
        if (!file) return
        
        const reader = new FileReader()
        reader.onload = async (ev) => {
            const text = ev.target.result
            const note = {
                id: `local-${Date.now()}`,
                title: file.name.replace(/\.(txt|md|markdown)$/i, ''),
                body: text,
                created_at: new Date().toISOString(),
                favorite: false
            }
            await saveNoteToDB(note)
            loadNoteIntoEditor(note)
            statusBar.textContent = 'Imported ' + file.name
        }
        reader.readAsText(file)
        e.target.value = ''
    })

    // 2. PDF Import (Backend)
    document.getElementById('btn-import-pdf').addEventListener('click', () => {
        document.getElementById('file-import-pdf').click()
    })
    document.getElementById('file-import-pdf').addEventListener('change', (e) => handleBackendImport(e, 'pdf'))

    // 3. PPT Import (Backend)
    document.getElementById('btn-import-ppt').addEventListener('click', () => {
        document.getElementById('file-import-ppt').click()
    })
    document.getElementById('file-import-ppt').addEventListener('change', (e) => handleBackendImport(e, 'pptx'))

    async function handleBackendImport(e, type) {
        const file = e.target.files[0]
        if (!file) return
        e.target.value = '' // reset

        statusBar.textContent = 'Uploading ' + file.name + '...'
        
        const fd = new FormData()
        fd.append('file', file)
        fd.append('ocr', '0') // Default no OCR
        fd.append('mode', type === 'pdf' ? 'pages' : 'slides') // Default modes

        try {
            // Check if backend is reachable first
            try {
                await fetch(`${window.__API_BASE__}/api/notes`, { method: 'HEAD' })
            } catch (connErr) {
                throw new Error('Cannot connect to backend server. Please ensure "npm run dev" and "npm run worker" are running.')
            }

            const res = await fetch(`${window.__API_BASE__}/api/import`, { method: 'POST', body: fd })
            if (!res.ok) {
                const txt = await res.text()
                throw new Error(`Server error (${res.status}): ${txt}`)
            }
            const json = await res.json()
            statusBar.textContent = 'Processing...'
            pollImportJob(json.jobId)
        } catch (err) {
            console.error(err)
            statusBar.textContent = 'Import failed'
            alert('Import failed: ' + err.message)
        }
    }

    async function pollImportJob(jobId) {
        let done = false
        while (!done) {
            await new Promise(r => setTimeout(r, 1500))
            try {
                const res = await fetch(`${window.__API_BASE__}/api/import/${jobId}/status`)
                const j = await res.json()
                if (j.status === 'completed') {
                    done = true
                    statusBar.textContent = 'Import complete'
                    if (j.result && j.result.notes) {
                        let lastNote = null
                        for (const n of j.result.notes) {
                             const note = {
                                id: `local-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                                title: n.title || 'Imported',
                                body: n.body || n.content || '',
                                created_at: new Date().toISOString(),
                                favorite: false
                            }
                            await saveNoteToDB(note)
                            lastNote = note
                        }
                        await loadNotesList()
                        if (lastNote) loadNoteIntoEditor(lastNote)
                    }
                } else if (j.status === 'failed') {
                    done = true
                    statusBar.textContent = 'Import failed'
                    alert('Import processing failed')
                }
            } catch (e) {
                done = true
                statusBar.textContent = 'Error polling'
            }
        }
    }

    // 7. Title Input Save
    titleInput.addEventListener('input', () => {
      if (currentNote) {
        currentNote.title = titleInput.value
        debounceSave(async () => {
          await saveNoteToDB(currentNote)
          loadNotesList()
        })
      }
    })

    // 8. Quick Switcher Logic
    const qsInput = document.getElementById('qs-input')
    const qsResults = document.getElementById('qs-results')
    
    qsInput.addEventListener('input', async (ev) => {
      const q = ev.target.value.toLowerCase()
      if (!q) { qsResults.innerHTML = ''; return }
      const notes = await getAllNotes()
      const hits = notes.filter(n => (n.title||'').toLowerCase().includes(q)).slice(0, 10)
      qsResults.innerHTML = hits.map(n => `<div class="note-item" data-id="${n.id}">${n.title || 'Untitled'}</div>`).join('')
    })
    
    qsResults.addEventListener('click', async (ev) => {
      const item = ev.target.closest('.note-item')
      if (!item) return
      const id = item.dataset.id
      const note = await getNoteById(id)
      if (note) {
        loadNoteIntoEditor(note)
        document.getElementById('qs-modal').classList.add('hidden')
      }
    })

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        document.getElementById('qs-modal').classList.remove('hidden')
        qsInput.focus()
      }
      if (e.key === 'Escape') {
        document.getElementById('qs-modal').classList.add('hidden')
        document.getElementById('draw-modal').classList.add('hidden')
        document.getElementById('import-iframe-modal').classList.add('hidden')
      }
    })

    // 9. Drawpad & Import (Keep existing logic mostly, just ensure wired)
    // ... (Drawpad logic is self-contained in previous script, need to re-add it or ensure it's covered)
    // Since I'm replacing the whole script, I need to include the Drawpad logic again.
    
    // --- Drawpad Logic ---
    let _drawCtx = null, _drawCanvas = null, _isDrawing = false
    
    function initDrawCanvasIfNeeded() {
      const container = document.getElementById('draw-container')
      if (!container || container.querySelector('canvas')) return
      
      const canvas = document.createElement('canvas')
      canvas.width = 800; canvas.height = 500;
      canvas.style.width = '100%'; canvas.style.height = '100%';
      canvas.style.borderRadius = '8px'; canvas.style.touchAction = 'none';
      container.innerHTML = ''; container.appendChild(canvas)
      
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height)
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 4
      
      _drawCanvas = canvas; _drawCtx = ctx
      
      function getPos(e) {
        const rect = canvas.getBoundingClientRect()
        const clientX = e.touches ? e.touches[0].clientX : e.clientX
        const clientY = e.touches ? e.touches[0].clientY : e.clientY
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
      }
      
      function start(e) { _isDrawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
      function move(e) { if(!_isDrawing)return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke() }
      function end() { _isDrawing = false; ctx.closePath() }
      
      canvas.addEventListener('pointerdown', start)
      canvas.addEventListener('pointermove', move)
      canvas.addEventListener('pointerup', end)
      canvas.addEventListener('pointercancel', end)
    }

    document.getElementById('btn-draw').addEventListener('click', () => {
      document.getElementById('draw-modal').classList.remove('hidden')
      initDrawCanvasIfNeeded()
    })
    
    document.getElementById('draw-save').addEventListener('click', () => {
      if(!_drawCanvas) return
      _drawCanvas.toBlob(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'drawing.png';
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      })
    })

    document.getElementById('draw-attach').addEventListener('click', async () => {
      if(!_drawCanvas) return
      const dataUrl = _drawCanvas.toDataURL('image/png')
      
      if (window.db) {
        const id = `att-${Date.now()}`
        try {
          await window.db.attachments.put({
            id: id,
            note_id: window.__currentNoteId,
            filename: 'drawing.png',
            data: dataUrl
          })
          console.log('Attachment saved:', id);
          insertFormatting(`\n![Drawing](attachment:${id})\n`)
          
          // Force preview update to ensure the attachment is rendered
          setTimeout(() => {
             if (window.cmView) {
                 const text = window.cmView.state.doc.toString();
                 console.log('Forcing preview update after attachment');
                 if (window.updatePreview) window.updatePreview(text);
             }
          }, 50);

        } catch (e) {
          console.error('Failed to save attachment', e)
          alert('Failed to save attachment to database. Using inline image instead.')
          insertFormatting(`\n![Drawing](${dataUrl})\n`)
        }
      } else {
        console.warn('Database not available');
        insertFormatting(`\n![Drawing](${dataUrl})\n`)
      }
      
      document.getElementById('draw-modal').classList.add('hidden')
    })
    
    document.getElementById('draw-clear').addEventListener('click', () => {
      if(_drawCtx) {
        _drawCtx.clearRect(0,0,_drawCanvas.width,_drawCanvas.height)
        _drawCtx.fillStyle='#fff'; _drawCtx.fillRect(0,0,_drawCanvas.width,_drawCanvas.height)
      }
    })
    
    document.getElementById('draw-close').addEventListener('click', () => {
      document.getElementById('draw-modal').classList.add('hidden')
    })

    // --- Mobile Sidebar Toggles ---
    const sidebar = document.querySelector('.sidebar')
    const overlay = document.getElementById('sidebar-overlay')
    
    document.getElementById('btn-menu').addEventListener('click', () => {
      sidebar.classList.toggle('open')
      overlay.classList.toggle('show')
    })
    
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open')
      overlay.classList.remove('show')
    })

    // --- Import Logic ---
    const btnImport = document.getElementById('btn-import')
    if (btnImport) {
      btnImport.addEventListener('click', () => {
        const modal = document.getElementById('import-iframe-modal')
        const iframe = document.getElementById('import-iframe')
        iframe.src = 'import.html'
        modal.classList.remove('hidden')
      })
    }
    
    document.getElementById('import-iframe-close').addEventListener('click', () => {
      document.getElementById('import-iframe-modal').classList.add('hidden')
      document.getElementById('import-iframe').src = 'about:blank'
    })
    
    window.addEventListener('message', async (ev) => {
      if (ev.data && ev.data.type === 'imported-file') {
        const { title, text } = ev.data
        const note = {
          id: `local-${Date.now()}`,
          title: title || 'Imported',
          body: text || '',
          created_at: new Date().toISOString(),
          favorite: false
        }
        await saveNoteToDB(note)
        loadNoteIntoEditor(note)
        document.getElementById('import-iframe-modal').classList.add('hidden')
      }
    })
