<script>
  import { vsmDataStore } from '../../stores/vsmDataStore.svelte.js'
  import { vsmUIStore } from '../../stores/vsmUIStore.svelte.js'
  import { vsmIOStore } from '../../stores/vsmIOStore.svelte.js'
  import { toastStore } from '../../stores/toastStore.svelte.js'
  import { undoStore } from '../../stores/undoStore.svelte.js'
  import { performUndo, performRedo } from '../../utils/undoHelper.js'
  import { exportAsJson, exportAsPng, exportAsPdf } from '../../utils/export/index.js'
  import ConfirmPopover from './ConfirmPopover.svelte'
  import { Undo2, Redo2, Download, Upload, FilePlus2, X } from 'lucide-svelte'

  let { onMenuClick } = $props()

  let isEditingName = $state(false)
  let tempName = $state(vsmDataStore.name)
  let fileInputRef = $state(null)
  let isExportOpen = $state(false)
  let exportMenuRef = $state(null)

  function handleNameClick() {
    tempName = vsmDataStore.name
    isEditingName = true
  }

  function handleNameSubmit() {
    if (tempName.trim()) {
      vsmDataStore.updateMapName(tempName.trim())
    }
    isEditingName = false
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') {
      handleNameSubmit()
    } else if (e.key === 'Escape') {
      isEditingName = false
    }
  }

  function handleExportJson() {
    const json = vsmIOStore.exportToJson()
    exportAsJson(json, `${vsmDataStore.name || 'vsm'}.json`)
  }

  function getFlowCanvas() {
    return document.querySelector('.svelte-flow')
  }

  async function handleExportPng() {
    const canvas = getFlowCanvas()
    if (!canvas) return

    try {
      await exportAsPng(canvas, `${vsmDataStore.name || 'vsm'}.png`)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to export PNG:', err)
      }
    }
  }

  async function handleExportPdf() {
    const canvas = getFlowCanvas()
    if (!canvas) return

    try {
      await exportAsPdf(canvas, `${vsmDataStore.name || 'vsm'}.pdf`)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to export PDF:', err)
      }
    }
  }

  function handleImport() {
    fileInputRef?.click()
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10000000) {
      toastStore.add('File is too large. Please select a file under 10 MB.', 'error')
      e.target.value = ''
      return
    }

    const isJson =
      file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')
    if (!isJson) {
      toastStore.add('Invalid file type. Please select a JSON file.', 'error')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = vsmIOStore.importFromJson(event.target.result)
      if (result) {
        vsmUIStore.closeWelcomeScreen()
      } else {
        toastStore.add('Failed to import file. Please check the format.', 'error')
      }
    }
    reader.onerror = () => {
      toastStore.add('Failed to read file.', 'error')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function toggleExportMenu() {
    isExportOpen = !isExportOpen
  }

  function closeExportMenu() {
    isExportOpen = false
  }

  function handleExportMenuKeyDown(e) {
    if (e.key === 'Escape') {
      isExportOpen = false
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const items = exportMenuRef?.querySelectorAll('[role="menuitem"]')
      if (items?.length) items[0].focus()
    }
  }

  function handleMenuItemKeyDown(e, items, index) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(index + 1) % items.length].focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(index - 1 + items.length) % items.length].focus()
    } else if (e.key === 'Escape') {
      isExportOpen = false
    }
  }

  function handleMenuContainerKeyDown(e) {
    const items = exportMenuRef?.querySelectorAll('[role="menuitem"]')
    if (!items?.length) return
    const index = Array.from(items).indexOf(document.activeElement)
    if (index !== -1) handleMenuItemKeyDown(e, items, index)
  }

  function goHome() {
    vsmUIStore.openWelcomeScreen()
  }
</script>

<header class="bg-white border-b border-gray-200 shrink-0 flex flex-col">
  <!-- Top Action Bar -->
  <div class="h-14 px-4 flex items-center justify-between">
    <div class="flex items-center gap-4">
      {#if onMenuClick}
        <button
          onclick={onMenuClick}
          class="lg:hidden -ml-1 rounded-md p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Open menu"
          data-testid="sidebar-toggle"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      {/if}

      <button 
        onclick={goHome}
        class="group flex items-center gap-2 p-1 -ml-1 hover:bg-gray-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="Go to Dashboard"
      >
        <!-- Logo phóng to nhẹ (scale-105) khi rê chuột vào group -->
        <img 
          src="https://i.logos-download.com/8838/2046-05803472c5828be1066b786bd79c64c8.png/Decathlon_Logo_2024.png" 
          alt="Decathlon" 
          class="h-6 w-auto transition-transform duration-200 group-hover:scale-105" 
        />
        <!-- Chữ VSM mặc định màu #0082C3, hover chuyển sang #3643ba -->
        <span class="font-bold text-xl text-[#0082C3] group-hover:text-[#3643ba] transition-colors hidden sm:inline">
          VSM
        </span>
      </button>

      <div class="h-6 w-px bg-gray-300 hidden sm:block"></div>

      {#if !vsmUIStore.showWelcomeScreen && vsmDataStore.id}
        {#if isEditingName}
          <input
            type="text"
            bind:value={tempName}
            onblur={handleNameSubmit}
            onkeydown={handleNameKeyDown}
            class="text-lg font-medium border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            aria-label="Map name"
            data-testid="map-name-input"
          />
        {:else}
          <button
            onclick={handleNameClick}
            aria-label="Edit map name"
            class="truncate max-w-[32vw] sm:max-w-none text-lg font-medium text-gray-800 hover:text-blue-600 transition-colors"
            data-testid="map-name"
          >
            {vsmDataStore.name}
          </button>
        {/if}
      {/if}
    </div>

    <div class="flex items-center gap-2">
      {#if !vsmUIStore.showWelcomeScreen}
        <div class="flex items-center gap-1 bg-gray-100 p-1 rounded-md mr-2 hidden sm:flex">
          <button
            class="p-1.5 rounded hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:hover:bg-transparent transition-all"
            onclick={performUndo}
            disabled={!undoStore.canUndo}
            title="Undo (Ctrl+Z)"
            data-testid="undo-button"
          >
            <Undo2 size={18} class="text-gray-700" />
          </button>
          <button
            class="p-1.5 rounded hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:hover:bg-transparent transition-all"
            onclick={performRedo}
            disabled={!undoStore.canRedo}
            title="Redo (Ctrl+Y)"
            data-testid="redo-button"
          >
            <Redo2 size={18} class="text-gray-700" />
          </button>
        </div>
      {/if}

      <button
        class="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
        onclick={() => vsmDataStore.createNewMap('Untitled Map')}
        data-testid="new-map-button"
      >
        <FilePlus2 size={16} />
        New Map
      </button>

      <input
        type="file"
        accept=".json"
        class="hidden"
        bind:this={fileInputRef}
        onchange={handleFileChange}
      />
      <button
        class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
        onclick={handleImport}
        data-testid="import-button"
      >
        <Upload size={16} />
        <span class="hidden sm:inline">Import</span>
      </button>

      <div class="relative">
        <button
          class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-[#0082C3] hover:bg-[#006A9F] rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onclick={toggleExportMenu}
          onkeydown={handleExportMenuKeyDown}
          aria-haspopup="menu"
          aria-expanded={isExportOpen}
          aria-label="Export options"
          data-testid="export-button"
        >
          <Download size={16} />
          Export
          <svg class="inline-block w-3 h-3 ml-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>

        {#if isExportOpen}
          <div
            bind:this={exportMenuRef}
            role="menu"
            onkeydown={handleMenuContainerKeyDown}
            class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1"
          >
            <button
              class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              onclick={() => { handleExportJson(); closeExportMenu() }}
              role="menuitem"
              data-testid="export-json"
            >
              Export as JSON
            </button>
            <button
              class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              onclick={() => { handleExportPng(); closeExportMenu() }}
              role="menuitem"
              data-testid="export-png"
            >
              Export as PNG Image
            </button>
            <button
              class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              onclick={() => { handleExportPdf(); closeExportMenu() }}
              role="menuitem"
              data-testid="export-pdf"
            >
              Export as PDF
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Multi-Tabs Bar (Like Chrome) -->
  {#if !vsmUIStore.showWelcomeScreen && vsmDataStore.openTabs.length > 0}
    <div class="flex items-end px-2 pt-2 bg-gray-100/50 overflow-x-auto w-full">
      {#each vsmDataStore.openTabs as tabId}
        {@const map = vsmDataStore.maps[tabId]}
        {@const isActive = vsmDataStore.id === tabId}
        <div
          class="group relative flex items-center h-9 px-4 min-w-[140px] max-w-[220px] border border-b-0 rounded-t-lg mr-1 cursor-pointer transition-colors select-none {isActive ? 'bg-white border-gray-300 text-[#004C97] font-medium z-10 before:absolute before:-bottom-[1px] before:left-0 before:right-0 before:h-[2px] before:bg-white' : 'bg-gray-200/70 border-gray-300/80 text-gray-600 hover:bg-gray-200'}"
          onclick={() => vsmDataStore.openMapInTab(tabId)}
        >
          <span class="truncate text-sm flex-1">{map?.name || 'Untitled Map'}</span>
          <button
            class="ml-2 p-0.5 rounded-md text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-300 hover:text-red-600 transition-all {isActive ? 'opacity-100' : ''}"
            onclick={(e) => { e.stopPropagation(); vsmDataStore.closeTab(tabId); }}
            title="Close tab"
          >
            <X size={14} strokeWidth={2.5}/>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</header>