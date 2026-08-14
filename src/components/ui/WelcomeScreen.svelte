<script>
  import { vsmDataStore } from '../../stores/vsmDataStore.svelte.js'
  import { vsmIOStore } from '../../stores/vsmIOStore.svelte.js'
  import { toastStore } from '../../stores/toastStore.svelte.js'
  import { MAP_TEMPLATES } from '../../data/stepTemplates.js'
  import { FileUp, File, LayoutTemplate, Trash2, Clock, Map } from 'lucide-svelte'

  let fileInputRef = $state(null)

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'map-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
  }

  let recentMaps = $derived(
    Object.values(vsmDataStore.maps).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  );

  function formatDate(isoString) {
    if (!isoString) return '';
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    }).format(new Date(isoString));
  }

  function handleStartWithExample() {
    vsmIOStore.loadExample()
  }

  // ĐÃ SỬA LỖI Ở ĐÂY: Khôi phục lại hàm gọi gốc để xử lý đúng cấu trúc Template
  function handleLoadTemplate(template) {
    vsmIOStore.loadTemplate(template)
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
      if (!result) {
        toastStore.add('Failed to import file. Please check the format.', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }
</script>

<div class="min-h-screen bg-gray-50/50 p-6 sm:p-12 flex flex-col items-center">
  <div class="mb-10 text-center">
    <div class="flex justify-center mb-4">
      <svg viewBox="0 0 100 100" class="w-16 h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 10 L90 30 L90 70 L50 90 L10 70 L10 30 Z" fill="#004C97" />
        <path d="M50 25 L75 38 L75 62 L50 75 L25 62 L25 38 Z" fill="#FFFFFF" />
        <path d="M50 35 L65 42 L65 58 L50 65 L35 58 L35 42 Z" fill="#004C97" />
      </svg>
    </div>
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Decathlon VSM</h1>
    <p class="text-gray-500 max-w-lg mx-auto">Value Stream & Flow Optimization</p>
    <p class="text-sm text-gray-400 mt-2 max-w-md mx-auto">
      Map your software delivery value streams, find bottlenecks, and optimize lead time.
    </p>
  </div>

  <div class="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8">
    <!-- LEFT COLUMN: ACTIONS -->
    <div class="lg:col-span-5 space-y-8">
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="p-6">
          <button
            class="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#0082C3] hover:bg-[#006A9F] text-white font-medium rounded-lg shadow-sm transition-colors text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onclick={() => vsmDataStore.createNewMap('Untitled Map')}
            data-testid="create-map-button"
          >
            <File size={20} />
            Create Blank Map
          </button>

          <div class="relative flex py-6 items-center">
            <div class="flex-grow border-t border-gray-200"></div>
            <span class="flex-shrink-0 mx-4 text-gray-400 text-sm">or start with a template</span>
            <div class="flex-grow border-t border-gray-200"></div>
          </div>

          <div class="space-y-3">
            <button
              onclick={handleStartWithExample}
              class="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-green-600 hover:bg-green-50 transition-colors flex items-start gap-3 group focus:outline-none focus:ring-2 focus:ring-green-500"
              data-testid="start-with-example-button"
            >
              <div class="mt-0.5 text-green-600">
                <span class="text-xl" aria-hidden="true">📊</span>
              </div>
              <div>
                <div class="font-semibold text-gray-900 group-hover:text-green-700 flex items-center gap-2">
                  Software Delivery Example
                </div>
                <div class="text-sm text-gray-500 mt-1">Full example with sample metrics</div>
              </div>
            </button>
            {#each MAP_TEMPLATES as template, i (template.id)}
              {@const colors = [
                { border: 'hover:border-teal-600', bg: 'hover:bg-teal-50', text: 'group-hover:text-teal-700', badge: 'bg-teal-100 text-teal-700' },
                { border: 'hover:border-cyan-600', bg: 'hover:bg-cyan-50', text: 'group-hover:text-cyan-700', badge: 'bg-cyan-100 text-cyan-700' },
              ]}
              {@const color = colors[i % colors.length]}
              <button
                onclick={() => handleLoadTemplate(template)}
                class="w-full text-left p-4 rounded-lg border border-gray-200 {color.border} {color.bg} transition-colors flex items-start gap-3 group focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="template-{template.id}-button"
              >
                <div class="mt-0.5">
                  <span class="text-xl" aria-hidden="true">
                    {template.id === 'software-delivery' ? '🚀' : '🎫'}
                  </span>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2 font-semibold text-gray-900 {color.text}">
                    {template.name}
                    <!-- Cập nhật số đếm Steps để tương thích với cấu trúc của template -->
                    <span
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium {color.badge}"
                      data-testid="template-step-count-{template.id}"
                    >
                      {template.steps ? template.steps.length : (template.mapData?.steps?.length || 0)} steps
                    </span>
                  </div>
                  <div class="text-sm text-gray-500 mt-1">
                    {template.description}
                  </div>
                </div>
              </button>
            {/each}
          </div>

          <div class="relative flex py-6 items-center">
            <div class="flex-grow border-t border-gray-200"></div>
            <span class="flex-shrink-0 mx-4 text-gray-400 text-sm">or import</span>
            <div class="flex-grow border-t border-gray-200"></div>
          </div>

          <input
            type="file"
            accept=".json"
            class="hidden"
            bind:this={fileInputRef}
            onchange={handleFileChange}
          />
          <button
            class="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            onclick={handleImport}
            data-testid="import-map-button"
          >
            <FileUp size={18} />
            Import Existing Map
          </button>
        </div>
      </div>
    </div>

    <!-- RIGHT COLUMN: RECENT MAPS -->
    <div class="lg:col-span-7">
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full min-h-[400px]">
        <h2 class="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
          <Clock size={20} class="text-[#004C97]"/>
          Recent Maps
        </h2>

        {#if recentMaps.length === 0}
          <div class="flex flex-col items-center justify-center h-64 text-gray-400">
            <Map size={48} class="mb-4 opacity-20"/>
            <p>No recent maps found.</p>
            <p class="text-sm mt-1">Create a new map to get started.</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {#each recentMaps as map}
              <button
                class="group border border-gray-200 rounded-xl p-4 hover:border-[#0082C3] hover:shadow-md transition-all text-left bg-white relative flex flex-col justify-between min-h-[110px] focus:outline-none focus:ring-2 focus:ring-[#0082C3]"
                onclick={() => vsmDataStore.openMapInTab(map.id)}
              >
                <div class="flex justify-between items-start mb-2 w-full">
                  <h3 class="font-medium text-gray-900 pr-8 line-clamp-2 leading-snug">
                    {map.name || 'Untitled Map'}
                  </h3>
                  <div
                    class="absolute top-3 right-3 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-gray-50 hover:bg-red-50 rounded-md border border-gray-100 z-10"
                    onclick={(e) => { e.stopPropagation(); vsmDataStore.deleteMap(map.id); }}
                    title="Delete Map"
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); vsmDataStore.deleteMap(map.id); } }}
                  >
                    <Trash2 size={16}/>
                  </div>
                </div>
                
                <div class="mt-auto flex items-center justify-between text-xs text-gray-500 w-full">
                  <span class="flex items-center gap-1.5 font-medium bg-gray-100 px-2 py-1 rounded-md text-gray-600">
                    <div class="w-1.5 h-1.5 rounded-full bg-[#0082C3]"></div>
                    {map.steps?.length || 0} steps
                  </span>
                  <span>{formatDate(map.updatedAt)}</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

  </div>
</div>