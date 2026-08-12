import { escapeHtml, sanitizeHtml } from '../utils/html-sanitizer.js';
import { eventBus } from '../utils/event-bus.js';

export class AgentHandler {
  constructor(apiClient, chatUI) {
    this.apiClient = apiClient;
    this.chatUI = chatUI;
    this.currentMode = 'chat';
    this.currentAgent = 'presentation';
    this.slides = [];
    this.currentSlideIndex = 0;
    this.csvData = null;
    this.csvSchema = null;
    this.cacheElements();
    this.bindEvents();
  }

  /**
   * Emit error event to UI (decoupled from direct ChatUI dependency)
   * @param {string} message - Error message
   * @param {string} type - Optional error type
   */
  showError(message, type) {
    eventBus.emit('agent:error', { message, type })
    // Fallback to direct call for backward compatibility
    if (this.chatUI && this.chatUI.showError) {
      this.chatUI.showError(message, type)
    }
  }

  /**
   * Emit toast event to UI (decoupled from direct ChatUI dependency)
   * @param {string} message - Toast message
   */
  showToast(message) {
    eventBus.emit('agent:toast', { message })
    // Fallback to direct call for backward compatibility
    if (this.chatUI && this.chatUI.showToast) {
      this.chatUI.showToast(message)
    }
  }

  getModelConfig(model) {
    const tier = this.getModelTier(model);
    const isGLM = model.toLowerCase().includes('glm');
    
    const configs = {
      high: { temperature: 0.3, maxTokens: isGLM ? 16000 : 4000 },
      medium: { temperature: 0.5, maxTokens: isGLM ? 12000 : 3000 },
      low: { temperature: 0.7, maxTokens: isGLM ? 8000 : 2000 }
    };
    return configs[tier];
  }

  getModelTier(model) {
    const lower = model.toLowerCase();
    if (lower.includes('gpt-5') || lower.includes('gpt-4o') || lower.includes('gpt-4') || lower.includes('claude-3.5') || lower.includes('claude-3-opus') || lower.includes('claude-4') || lower.includes('gemini-1.5-pro') || lower.includes('gemini-2.0') || lower.includes('gemini-2.5') || lower.includes('glm-4.7') || lower.includes('glm-4-plus') || lower.includes('glm-5')) {
      return 'high';
    } else if (lower.includes('gpt-4-turbo') || lower.includes('claude-3') || lower.includes('mistral-large') || lower.includes('gemini-1.5') || lower.includes('glm-4') || lower.includes('glm-4.5')) {
      return 'medium';
    }
    return 'low';
  }

  parseJSONSafely(text, key = 'slides') {
    let cleaned = text;
    
    cleaned = cleaned.replace(/^```(?:json|javascript)?\s*/i, '').replace(/```$/g, '');
    
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    } else {
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objMatch) cleaned = objMatch[0];
    }
    
    try {
      const parsed = JSON.parse(cleaned);
      if (key === 'slides') {
        return Array.isArray(parsed) ? parsed : [];
      }
      return parsed;
    } catch (e) {
      const arrayMatch = cleaned.match(/\[[\s\S]*?\]/g);
      if (arrayMatch) {
        for (let i = arrayMatch.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(arrayMatch[i]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
          } catch {}
        }
      }
      throw new Error('Could not extract valid JSON from response');
    }
  }

  /**
   * Strict CSP injected into every AI-generated HTML document before it is
   * rendered (sandbox preview, pop-out tab, print window). `connect-src
   * 'none'` blocks fetch/XHR/WebSocket entirely, so even a prompt-injected
   * AI HTML document cannot exfiltrate the injected data. Inline scripts are
   * allowed only where the destination is a Chrome sandbox page (opaque
   * origin, no chrome.* APIs); pop-out/print paths additionally rely on the
   * extension CSP to block inline scripts.
   */
  getSandboxCsp() {
    return "<meta http-equiv='Content-Security-Policy' content=\"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; font-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'\">";
  }

  cleanHTML(html) {
    let cleaned = html;
    
    cleaned = cleaned.replace(/^```(?:html)?\s*/i, '').replace(/```$/g, '');
    
    cleaned = cleaned.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, content) => {
      if (content && content.trim().length > 0 && !content.includes('window.') && !content.includes('document.')) {
        return match;
      }
      return '';
    });
    
    cleaned = cleaned.replace(/<script[^>]*src=["']?https?:\/\/[^"']*cdn[^"']*["']?[^>]*><\/script>/gi, '');
    cleaned = cleaned.replace(/<link[^>]*href=["']?https?:\/\/[^"']*cdn[^"']*["']?[^>]*>/gi, '');
    
    cleaned = cleaned.replace(/\s*src=["']https?:\/\/[^"']*cdn[^"']*["']/gi, '');
    cleaned = cleaned.replace(/\s*href=["']https?:\/\/[^"']*cdn[^"']*["']/gi, '');
    
    cleaned = cleaned.replace(/url\(["']?https?:\/\/[^"']*cdn[^"']*["']?\)/gi, 'none');
    
    return cleaned;
  }

  validateSlides(slides) {
    if (!Array.isArray(slides) || slides.length === 0) return [];
    const THEMES = ['corporate', 'creative', 'minimal', 'academic'];
    const VISUALS = ['gradient-dark', 'gradient-light', 'gradient-gold', 'gradient-blue', 'gradient-purple', 'solid', 'minimal'];
    const LAYOUTS = ['title-center', 'title-left', 'content-left', 'content-right', 'two-column'];
    const POSITIONS = ['background', 'center', 'left', 'right'];
    return slides.filter(slide => 
      slide && typeof slide.title === 'string' && 
      (slide.type === 'title' || slide.type === 'content' || slide.type === 'comparison' || slide.type === 'data')
    ).map(slide => ({
      type: slide.type || 'content',
      title: slide.title || 'Untitled',
      content: slide.content || [],
      theme: THEMES.includes(slide.theme) ? slide.theme : 'corporate',
      visualStyle: VISUALS.includes(slide.visualStyle) ? slide.visualStyle : 'gradient-dark',
      imageQuery: slide.imageQuery || '',
      imagePosition: POSITIONS.includes(slide.imagePosition) ? slide.imagePosition : 'background',
      imageUrl: /^https?:\/\//.test(slide.imageUrl || '') ? slide.imageUrl : '',
      accentColor: /^#[0-9a-fA-F]{3,8}$/.test(slide.accentColor || '') ? slide.accentColor : '#3b82f6',
      layout: LAYOUTS.includes(slide.layout) ? slide.layout : 'content-left'
    }));
  }

  async searchImages(query) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'EXECUTE_TOOL', tool: 'image_search', args: { query } },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  async webSearch(query) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'EXECUTE_TOOL', tool: 'web_search', args: { query } },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  cacheElements() {
    this.elements = {
      modeChat: document.getElementById('mode-chat'),
      modeAgent: document.getElementById('mode-agent'),
      chatContainer: document.getElementById('chat-container'),
      inputWrapper: document.querySelector('.input-wrapper'),
      agentWorkspace: document.getElementById('agent-workspace'),
      agentTabs: document.querySelectorAll('.agent-tab'),
      agentPanels: document.querySelectorAll('.agent-panel'),
      agentLoading: document.getElementById('agent-loading'),
      agentLoadingText: document.getElementById('agent-loading-text'),
      slidePrompt: document.getElementById('slide-prompt'),
      generateSlidesBtn: document.getElementById('generate-slides-btn'),
      slideViewer: document.getElementById('slide-viewer'),
      prevSlideBtn: document.getElementById('prev-slide-btn'),
      nextSlideBtn: document.getElementById('next-slide-btn'),
      slideCounter: document.getElementById('slide-counter'),
      exportPptBtn: document.getElementById('export-ppt-btn'),
      dataDropZone: document.getElementById('data-drop-zone'),
      dataFileInput: document.getElementById('data-file-input'),
      dataFileInfo: document.getElementById('data-file-info'),
      dataFileName: document.querySelector('#data-file-info .filename'),
      removeDataFileBtn: document.getElementById('remove-data-file'),
      dataPrompt: document.getElementById('data-prompt'),
      analyzeDataBtn: document.getElementById('analyze-data-btn'),
      dataSandbox: document.getElementById('data-sandbox'),
      dataEmptyState: document.getElementById('data-empty-state'),
      dataExportBtn: document.getElementById('export-data-btn'),
      mvpPrompt: document.getElementById('mvp-prompt'),
      generateMvpBtn: document.getElementById('generate-mvp-btn'),
      mvpSandbox: document.getElementById('mvp-sandbox'),
      popoutMvpBtn: document.getElementById('popout-mvp-btn'),
      mvpDownloadBtn: document.getElementById('download-mvp-btn'),
      mvpCopyBtn: document.getElementById('copy-mvp-btn'),
      researchPrompt: document.getElementById('research-prompt'),
      researchOnlineCheckbox: document.getElementById('research-online'),
      generateResearchBtn: document.getElementById('generate-research-btn'),
      researchSandbox: document.getElementById('research-sandbox'),
      popoutResearchBtn: document.getElementById('popout-research-btn'),
      researchExportBtn: document.getElementById('export-research-btn'),
      modelSelect: document.getElementById('model-select')
    };
  }

  bindEvents() {
    // The legacy agent-workspace UI (mode toggles, slide viewer, data
    // workspace, MVP/research workspace buttons) was removed from the DOM.
    // The slash-command entry points (generateSlidesFromPrompt,
    // generateMvpFromPrompt, generateResearchFromPrompt) are wired from
    // sidepanel.js executeCommand, so there is nothing left to bind here.
  }

  setLoading(isLoading, text = 'Working on it...') {
    // The legacy agent-workspace loading overlay was removed from the DOM;
    // guard so callers (old and new) don't throw when it's absent.
    if (!this.elements.agentLoading) return;
    if (isLoading) {
      if (this.elements.agentLoadingText) this.elements.agentLoadingText.textContent = text;
      this.elements.agentLoading.classList.remove('hidden');
    } else {
      this.elements.agentLoading.classList.add('hidden');
    }
  }

  /**
   * Asks the LLM for a slide deck as a bare JSON array (same convention
   * parseJSONSafely already expects for key === 'slides'):
   *   [{ "title": string, "bullets": string[] }, ...]
   * Retries once with a simplified prompt on failure, same pattern as
   * _generateMvpHtml / _generateResearchHtml. Returns a normalized
   * { title, slides } object. Throws if no usable slides come back.
   */
  async _generateSlideDeck(prompt) {
    const model = this.elements.modelSelect ? this.elements.modelSelect.value : undefined;
    const modelConfig = this.getModelConfig(model || '');

    const systemPrompt = `You are an expert presentation writer. Given a topic, design a concise slide deck.

CRITICAL RULES (STRICT):
1. Output ONLY raw JSON. No markdown, no code fences, no explanation before or after.
2. Output a single JSON ARRAY (start with '[' and end with ']') matching exactly this schema:
   [{ "title": string, "bullets": string[] }, ...]
3. "bullets" is an array of short strings (max ~12 words each), 3-5 bullets per slide. A pure title/section slide may use an empty array or a single subtitle string.
4. Produce between 5 and 10 slides total: the first slide is the deck title slide, the last is a closing/summary slide.
5. Keep all text plain — no markdown, no HTML tags.

EXAMPLE OUTPUT:
[{"title":"Q3 Growth Strategy","bullets":["A one-line subtitle framing the deck"]},{"title":"The Problem","bullets":["Point one","Point two","Point three"]},{"title":"Thank You","bullets":["Questions?"]}]`;

    const simplifiedPrompt = `Create a slide deck outline as a raw JSON array only, no markdown, no code fences.
Schema: [{"title": "string", "bullets": ["string", ...]}]
5-8 slides, first is a title slide, last is a closing slide.
Topic: ${prompt}`;

    let response, rawSlides;

    try {
      response = await this.chatUI.chatViaBackground([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ], { model: model, streaming: false, temperature: modelConfig.temperature, maxTokens: modelConfig.maxTokens });

      rawSlides = this.parseJSONSafely(response.choices[0].message.content, 'slides');
    } catch (firstError) {
      console.warn('First slide-generation attempt failed, retrying with simplified prompt:', firstError.message);
      this.setLoading(true, 'Retrying with a simpler prompt...');

      response = await this.chatUI.chatViaBackground([
        { role: 'system', content: simplifiedPrompt },
        { role: 'user', content: prompt }
      ], { model: model, streaming: false, temperature: 0.3, maxTokens: 2000 });

      rawSlides = this.parseJSONSafely(response.choices[0].message.content, 'slides');
    }

    return this._normalizeSlideDeck(rawSlides, prompt);
  }

  /**
   * Cleans/caps the raw LLM slide array into a safe { title, slides } shape.
   * Drops malformed entries, caps bullets per slide, and caps the deck at
   * 12 slides. Throws if nothing usable survives, so callers can fall back
   * to a clear error message instead of rendering an empty deck.
   */
  _normalizeSlideDeck(rawSlides, prompt) {
    const list = Array.isArray(rawSlides) ? rawSlides : [];

    const cleaned = list
      .filter(s => s && typeof s.title === 'string' && s.title.trim())
      .slice(0, 12)
      .map(s => {
        let bullets;
        if (Array.isArray(s.bullets)) {
          bullets = s.bullets.filter(b => typeof b === 'string' && b.trim()).slice(0, 6).map(b => b.trim().slice(0, 200));
        } else if (typeof s.bullets === 'string' && s.bullets.trim()) {
          bullets = [s.bullets.trim().slice(0, 200)];
        } else {
          bullets = [];
        }
        return { title: s.title.trim().slice(0, 120), bullets };
      });

    if (cleaned.length === 0) {
      throw new Error('No valid slides generated');
    }

    return { title: cleaned[0].title || prompt, slides: cleaned };
  }

  /**
   * Renders a normalized slide deck as a standalone HTML document (same
   * wrapping convention as _generateMvpHtml / _generateResearchHtml: an
   * injected Tailwind script plus content), suitable for codePane.showPreview().
   * Also loads pptxgen.bundle.js inside that document and wires an inline
   * "Export as PPTX" button so exporting works entirely within the
   * sandboxed preview iframe, without needing to reach back across frames.
   */
  _renderSlideDeckHtml(deck, prompt) {
    const gradients = [
      'linear-gradient(135deg, #0f0c29 0%, #302b63 100%)',
      'linear-gradient(135deg, #1e3a8a 0%, #0ea5e9 100%)',
      'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
      'linear-gradient(135deg, #24243e 0%, #302b63 100%)'
    ];

    const slidesHtml = deck.slides.map((slide, i) => {
      const bg = gradients[i % gradients.length];
      const bulletsHtml = slide.bullets.length
        ? `<ul class="space-y-3">${slide.bullets.map(b => `<li class="flex items-start gap-3 text-lg text-gray-200"><span class="mt-2 h-1.5 w-1.5 rounded-full bg-[#d4af37] flex-shrink-0"></span><span>${escapeHtml(b)}</span></li>`).join('')}</ul>`
        : '';
      return `<section class="rounded-2xl p-10 mb-6 shadow-xl" style="background:${bg};">
        <div class="text-xs uppercase tracking-widest text-white/50 mb-3">Slide ${i + 1} of ${deck.slides.length}</div>
        <h2 class="text-3xl font-bold text-white mb-6">${escapeHtml(slide.title)}</h2>
        ${bulletsHtml}
      </section>`;
    }).join('\n');

    // Slide data for the in-preview exporter. Escaping "</script" prevents
    // the JSON payload from prematurely closing the surrounding <script> tag.
    const slidesJson = JSON.stringify(deck.slides).replace(/<\/script/gi, '<\\/script');
    const deckTitleJson = JSON.stringify(deck.title || prompt);

    const bodyHtml = `<div class="min-h-screen bg-[#0a0a12] text-white px-6 py-8">
      <div class="max-w-3xl mx-auto">
        <div class="flex items-center justify-between mb-8 gap-4">
          <div>
            <div class="text-xs uppercase tracking-widest text-[#d4af37] mb-1">Slide Deck</div>
            <h1 class="text-2xl font-bold">${escapeHtml(deck.title || prompt)}</h1>
          </div>
          <button id="export-pptx-btn" class="px-4 py-2 rounded-lg bg-[#d4af37] text-[#1a1a2e] font-semibold text-sm hover:brightness-110 transition flex-shrink-0">Export as PPTX</button>
        </div>
        ${slidesHtml}
      </div>
    </div>
    <script>
      var CTRL_SLIDES = ${slidesJson};
      var CTRL_DECK_TITLE = ${deckTitleJson};
      (function () {
        var btn = document.getElementById('export-pptx-btn');
        if (!btn) return;
        if (typeof PptxGenJS === 'undefined') {
          btn.disabled = true;
          btn.textContent = 'PPTX export unavailable';
          btn.classList.add('opacity-50', 'cursor-not-allowed');
          return;
        }
        btn.addEventListener('click', function () {
          var originalText = btn.textContent;
          btn.disabled = true;
          btn.textContent = 'Exporting...';
          function reset(label) {
            btn.textContent = label;
            setTimeout(function () { btn.textContent = originalText; btn.disabled = false; }, 2000);
          }
          try {
            var pptx = new PptxGenJS();
            CTRL_SLIDES.forEach(function (s, i) {
              var slide = pptx.addSlide();
              slide.background = { color: '1A1A2E' };
              slide.addText(s.title || '', {
                x: 0.5, y: 0.4, w: 9, h: 1,
                fontSize: i === 0 ? 34 : 26, bold: true, color: 'FFFFFF', fontFace: 'Arial'
              });
              if (s.bullets && s.bullets.length) {
                var bulletItems = s.bullets.map(function (b) {
                  return { text: b, options: { bullet: true, breakLine: true, color: 'E5E7EB' } };
                });
                slide.addText(bulletItems, { x: 0.6, y: 1.6, w: 8.6, h: 3.6, fontSize: 18, fontFace: 'Arial', valign: 'top' });
              }
            });
            var fileName = (CTRL_DECK_TITLE || 'CTRL-Slides').replace(/[^a-z0-9\\-_ ]/gi, '').trim().slice(0, 60) || 'CTRL-Slides';
            pptx.writeFile({ fileName: fileName + '.pptx' })
              .then(function () { reset('Exported!'); })
              .catch(function (e) { console.error('PPTX export failed', e); reset('Export failed'); });
          } catch (e) {
            console.error('PPTX export failed', e);
            reset('Export failed');
          }
        });
      })();
    <\/script>`;

    const tailwindScript = "<script src='../lib/tailwindcss.js'></script>";
    const pptxScript = "<script src='../lib/pptxgen.bundle.js'></script>";
    return "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>" + tailwindScript + pptxScript + "</head><body>" + bodyHtml + "</body></html>";
  }

  /**
   * /slides slash command entry point. Generates a structured slide deck via
   * the LLM (same call pattern as generateMvpFromPrompt / generateResearchFromPrompt),
   * renders it as an HTML preview, and shows it in the code pane's Preview
   * tab. The rendered preview includes its own "Export as PPTX" button
   * (see _renderSlideDeckHtml) that builds a real .pptx via pptxgen.bundle.js.
   */
  async generateSlidesFromPrompt(prompt) {
    const trimmed = (prompt || '').trim();
    if (!trimmed) return;

    if (!this.chatUI?.codePane) {
      this.showError('Slide preview is unavailable right now.');
      this.chatUI?.addMessage?.("Couldn't open the preview pane to show the slide deck. Try reloading the panel.", 'assistant', Date.now());
      return;
    }

    try {
      this.chatUI.codePane.showOutput('<div class="output-loading">Designing slide deck...</div>');

      const deck = await this._generateSlideDeck(trimmed);
      const fullHtml = this._renderSlideDeckHtml(deck, trimmed);

      this.currentSlideDeck = deck;
      this.chatUI.codePane.showPreview(fullHtml);
      this.chatUI?.addMessage?.(`Built a ${deck.slides.length}-slide deck for: "${trimmed}". Check the Preview tab in the code pane below — use the Export as PPTX button there to download it.`, 'assistant', Date.now());
    } catch (e) {
      console.error(e);
      this.showError('Failed to generate slides. Try a different or simpler topic.');
      this.chatUI?.codePane?.showOutput(`<div class="output-empty">Slide generation failed: ${escapeHtml(e.message || 'Unknown error')}. Try a simpler topic.</div>`);
    } finally {
      this.setLoading(false);
    }
  }

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Core MVP-generation logic, shared by the legacy workspace button
   * (generateMvp) and the /mvp slash command (generateMvpFromPrompt).
   * Returns the full generated HTML document as a string.
   */
  async _generateMvpHtml(prompt) {
    const model = this.elements.modelSelect ? this.elements.modelSelect.value : undefined;
    const modelConfig = this.getModelConfig(model || '');

    const imageQuery = prompt.length > 20 ? prompt.substring(0, 50) : prompt;
    let heroImageUrl = null;
    try {
      const imageResult = await this.searchImages(imageQuery + ' hero image modern');
      if (imageResult && imageResult.images && imageResult.images.length > 0) {
        heroImageUrl = imageResult.images[0].url;
      }
    } catch (e) {
      console.warn('Image search failed:', e);
    }

    const systemPrompt = `You are an expert Frontend Developer and UX Designer.
Create a complete, single-file HTML website based on the user's idea.

CRITICAL RULES (STRICT):
1. Output ONLY raw HTML starting with <!DOCTYPE or <html. No markdown, no explanations.
2. DO NOT include any CDN script tags (Tailwind). It's ALREADY injected.
3. DO NOT use <link> tags for external stylesheets.
4. Use inline Tailwind CSS classes for styling.
5. Make it look modern, visually appealing with gradients and shadows.

VISUAL ENHANCEMENT (REQUIRED):
- Add a hero section with a background image (use the provided imageQuery to search for relevant images)
- Use gradient overlays: bg-gradient-to-r from-purple-900/90 to-blue-900/90
- Add floating geometric shapes with CSS animations
- Use glassmorphism: bg-white/10 backdrop-blur-lg rounded-2xl
- Add subtle particle effect or gradient animation
- Professional typography with proper spacing

OUTPUT TEMPLATE:
<!DOCTYPE html>
<html>
<head><script src="../lib/tailwindcss.js"></script></head>
<body class="bg-gray-900 text-white">
  <div class="fixed inset-0 -z-10" style="background: linear-gradient(-45deg, #0f0c29, #302b63, #24243e, #1a1a2e); background-size: 400% 400%; animation: gradient 15s ease infinite;"></div>
  <style>@keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } } @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }</style>
  
  <nav class="p-6 flex justify-between items-center backdrop-blur-md bg-white/5">
    <h1 class="text-2xl font-bold">My App</h1>
  </nav>
  
  <header class="relative h-[70vh] flex items-center justify-center text-center px-6">
    <div class="max-w-4xl">
      <h1 class="text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">Title Here</h1>
      <p class="text-xl text-gray-300 mb-8">Subtitle</p>
    </div>
  </header>
</body>
</html>`;

    const simplifiedPrompt = `Create a modern single-page website with Tailwind CSS.
Output raw HTML only, no markdown.
Include a hero section with gradient background, features grid, and contact form.
Use dark theme with animated gradient background.`;

    let response, cleanHtml;

    try {
      response = await this.chatUI.chatViaBackground([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ], { model: model, streaming: false, temperature: modelConfig.temperature, maxTokens: modelConfig.maxTokens });

      cleanHtml = this.cleanHTML(response.choices[0].message.content);
    } catch (firstError) {
      console.warn('First attempt failed, retrying with simplified prompt:', firstError.message);
      this.setLoading(true, 'Retrying with simpler prompt...');

      response = await this.chatUI.chatViaBackground([
        { role: 'system', content: simplifiedPrompt },
        { role: 'user', content: prompt }
      ], { model: model, streaming: false, temperature: 0.3, maxTokens: 2000 });

      cleanHtml = this.cleanHTML(response.choices[0].message.content);
    }

    if (!cleanHtml || cleanHtml.length < 100) {
      throw new Error('Invalid HTML generated');
    }

    if (heroImageUrl) {
      cleanHtml = cleanHtml.replace('<header class="relative h-[70vh]', `<header class="relative h-[70vh]"><img src="${heroImageUrl}" class="absolute inset-0 w-full h-full object-cover opacity-30" /><div class="relative z-10">`).replace('</header>', '</div></header>');
    }

    const tailwindScript = "<script src='../lib/tailwindcss.js'></script>";
    const fullHtml = "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>" + this.getSandboxCsp() + tailwindScript + "</head><body>" + cleanHtml + "</body></html>";

    return fullHtml;
  }

  /**
   * Legacy workspace-button entry point. The agent-workspace UI (mvpPrompt,
   * mvpSandbox, etc.) was removed from the DOM, so this is a no-op unless
   * those elements somehow exist again.
   */
  /**
   * /mvp slash command entry point. Builds the MVP HTML and renders it in
   * the code pane's Preview tab (the current replacement for the old
   * sandboxed workspace iframe).
   */
  async generateMvpFromPrompt(prompt) {
    const trimmed = (prompt || '').trim();
    if (!trimmed) return;

    try {
      const fullHtml = await this._generateMvpHtml(trimmed);
      this.currentMvpHtml = fullHtml;
      this.chatUI?.codePane?.showPreview(fullHtml);
      this.chatUI?.addMessage?.(`Built an MVP preview for: "${trimmed}". Check the Preview tab in the code pane below.`, 'assistant', Date.now());
    } catch (e) {
      console.error(e);
      this.showError('Failed to generate MVP. Try a simpler description.');
      this.chatUI?.codePane?.showOutput('<div class="output-empty">MVP generation failed. Try a simpler description.</div>');
    }
  }

  /**
   * Core research-report generation logic, shared by the legacy workspace
   * button (generateResearch) and the /research slash command
   * (generateResearchFromPrompt). Returns the full generated HTML document.
   */
  async _generateResearchHtml(prompt, doResearch) {
    const model = this.elements.modelSelect ? this.elements.modelSelect.value : undefined;
    const modelConfig = this.getModelConfig(model || '');
    this.setLoading(true, doResearch ? 'Researching online...' : 'Generating report...');

    try {
      let researchData = '';
      
      if (doResearch) {
        this.setLoading(true, 'Searching the web...');
        const searchQueries = [
          prompt + ' statistics 2024',
          prompt + ' latest trends',
          prompt + ' key findings'
        ];
        
        for (const query of searchQueries) {
          try {
            const result = await this.webSearch(query);
            if (result && result.results) {
              researchData += `\n\n=== ${query} ===\n${result.results}`;
            }
          } catch (e) {
            console.warn('Search failed for:', query);
          }
        }
        
        if (!researchData) {
          researchData = 'Web research unavailable. Using general knowledge.';
        }
        
        this.setLoading(true, 'Generating report with research data...');
      }

      let topicImageUrl = null;
      try {
        const imageResult = await this.searchImages(prompt + ' research visualization');
        if (imageResult && imageResult.images && imageResult.images.length > 0) {
          topicImageUrl = imageResult.images[0].url;
        }
      } catch (e) {
        console.warn('Image search failed:', e);
      }

      const userContent = doResearch 
        ? `Topic: ${prompt}\n\nResearch Data:\n${researchData}\n\nGenerate a comprehensive research report based on the above research.`
        : prompt;

      const systemPrompt = `You are an expert Research Analyst and Frontend Developer.
Create an interactive research report on the specified topic.
Use the 'research-visualization' aesthetic: elegant, academic, with data visualizations.

CRITICAL RULES (STRICT):
1. Output ONLY raw HTML starting with <!DOCTYPE or <html. No markdown, no explanations.
2. DO NOT include any CDN script tags (Tailwind, ChartJS). They are ALREADY injected.
3. DO NOT use <link> tags for external stylesheets.
4. Use inline Tailwind CSS classes.

CHART GENERATION (REQUIRED):
Include realistic sample data and create actual Chart.js visualizations. The charts should show:
- A line chart showing trends over time (e.g., quarterly growth, market trends)
- A bar chart comparing categories or metrics

Use the gold accent color (#d4af37) for chart elements to match the theme.

STYLE REQUIREMENTS:
- Background: bg-[#F9F8F4] (warm cream) or use animated gradient
- Text: text-stone-800, text-stone-600
- Accents: Use text-[#d4af37] (gold) for highlights
- Typography: font-serif for headings, tracking-wide for labels
- Components: Cards with shadow-lg, hover:shadow-xl, rounded-2xl
- Dark sections: bg-stone-900 text-stone-100 with subtle animations

STRUCTURE REQUIRED:
<nav>, <header class="hero">, <section id="overview">, <section id="data" class="bg-stone-900">, <footer class="bg-stone-900">

OUTPUT TEMPLATE:
<!DOCTYPE html>
<html>
<head><script src="../lib/tailwindcss.js"></script><script src="../lib/chart.umd.js"></script></head>
<body class="bg-[#F9F8F4] text-stone-800">
  <nav class="fixed top-0 w-full p-6 flex justify-between items-center bg-[#F9F8F4]/95 backdrop-blur-md z-50">
    <div class="text-xl font-serif font-bold">Research Report</div>
  </nav>
  <header class="relative min-h-[80vh] flex items-center justify-center">
    <h1 class="font-serif text-6xl">Research Title</h1>
  </header>
  <section id="overview" class="py-24">
    <div class="grid grid-cols-3 gap-8"><div class="bg-white rounded-2xl p-8">Key Finding</div></div>
  </section>
  <section id="data" class="py-24 bg-stone-900 text-white">
    <div class="max-w-6xl mx-auto">
      <h2 class="font-serif text-4xl mb-8 text-center">Data Analysis</h2>
      <div class="grid grid-cols-2 gap-8">
        <div class="bg-stone-800 rounded-2xl p-6">
          <h3 class="text-white/70 mb-4">Trends Over Time</h3>
          <canvas id="trendChart"></canvas>
        </div>
        <div class="bg-stone-800 rounded-2xl p-6">
          <h3 class="text-white/70 mb-4">Category Comparison</h3>
          <canvas id="barChart"></canvas>
        </div>
      </div>
    </div>
  </section>
  <footer class="bg-stone-900 text-stone-400 py-12">Generated by CTRL</footer>
  <script>
    // Line Chart - Trends
    const trendCtx = document.getElementById('trendChart')?.getContext('2d');
    if (trendCtx) {
      new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'],
          datasets: [{
            label: 'Growth Rate (%)',
            data: [12, 19, 25, 32],
            borderColor: '#d4af37',
            backgroundColor: 'rgba(212, 175, 55, 0.2)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: 'white' } } },
          scales: {
            x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
            y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } }
          }
        }
      });
    }
    
    // Bar Chart - Comparison
    const barCtx = document.getElementById('barChart')?.getContext('2d');
    if (barCtx) {
      new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: ['Category A', 'Category B', 'Category C', 'Category D'],
          datasets: [{
            label: 'Performance',
            data: [65, 45, 78, 52],
            backgroundColor: ['#8b5cf6', '#ec4899', '#06b6d4', '#d4af37']
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: 'white' } } },
          scales: {
            x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
            y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } }
          }
        }
      });
    }
  </script>
</body>
</html>`;

      const simplifiedPrompt = `Create a research report HTML page with:
- Warm cream background (#F9F8F4)
- Gold accent color (#d4af37)
- Hero section, findings cards section, dark data section
- A Chart.js line chart and bar chart in the dark section (use sample data)
Output raw HTML only.`;

      let response, cleanHtml;

      try {
        response = await this.chatUI.chatViaBackground([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ], { model: model, streaming: false, temperature: modelConfig.temperature, maxTokens: modelConfig.maxTokens });

        cleanHtml = this.cleanHTML(response.choices[0].message.content);
      } catch (firstError) {
        console.warn('First attempt failed, retrying with simplified prompt:', firstError.message);
        this.setLoading(true, 'Retrying...');

        response = await this.chatUI.chatViaBackground([
          { role: 'system', content: simplifiedPrompt },
          { role: 'user', content: prompt }
        ], { model: model, streaming: false, temperature: 0.3, maxTokens: 2000 });

        cleanHtml = this.cleanHTML(response.choices[0].message.content);
      }

      if (!cleanHtml || cleanHtml.length < 100) {
        throw new Error('Invalid HTML generated');
      }

      if (topicImageUrl) {
        const imgTag = `<img src="${topicImageUrl}" class="absolute inset-0 w-full h-full object-cover opacity-20" />`;
        cleanHtml = cleanHtml.replace(/<header class="[^"]*relative[^"]*min-h-\[80vh\]/, `<header class="relative min-h-[80vh]">${imgTag}<div class="relative z-10">`);
        cleanHtml = cleanHtml.replace(/<\/header>/, '</div></header>');
      }

      const tailwindScript = "<script src='../lib/tailwindcss.js'></script>";
      const chartJsScript = "<script src='../lib/chart.umd.js'></script>";
      const fullHtml = "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>" + this.getSandboxCsp() + tailwindScript + chartJsScript + "</head><body>" + cleanHtml + "</body></html>";

      return fullHtml;

    } catch (e) {
      console.error(e);
      throw new Error('Failed to generate research report. Try a broader topic.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Legacy workspace-button entry point. The agent-workspace UI
   * (researchPrompt, researchSandbox, etc.) was removed from the DOM, so
   * this is a no-op unless those elements somehow exist again.
   */
  /**
   * /research slash command entry point. Runs web research (always on,
   * since that's the point of invoking /research explicitly) and renders
   * the report in the code pane's Preview tab.
   */
  async generateResearchFromPrompt(prompt) {
    const trimmed = (prompt || '').trim();
    if (!trimmed) return;

    try {
      const fullHtml = await this._generateResearchHtml(trimmed, true);
      this.currentResearchHtml = fullHtml;
      this.chatUI?.codePane?.showPreview(fullHtml);
      this.chatUI?.addMessage?.(`Researched "${trimmed}" and built a report. Check the Preview tab in the code pane below.`, 'assistant', Date.now());
    } catch (e) {
      console.error(e);
      this.showError('Failed to generate research report. Try a broader topic.');
      this.chatUI?.codePane?.showOutput('<div class="output-empty">Research generation failed. Try a broader topic.</div>');
    } finally {
      this.setLoading(false);
    }
  }
}
