(function() {
  'use strict'

  const EXCLUDED_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'NAV', 'HEADER', 'FOOTER', 'ASIDE']
  const EXCLUDED_CLASSES = ['nav', 'menu', 'sidebar', 'advertisement', 'ads', 'social', 'comment', 'footer', 'header']
  const MAX_TEXT_LENGTH = 10000

  let selectedText = ''

  function init() {
    setupTextSelection()
    setupMessageListener()
  }

  function setupTextSelection() {
    document.addEventListener('mouseup', handleTextSelection)
    document.addEventListener('keyup', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        setTimeout(handleTextSelection, 100)
      }
    })
  }

  function handleTextSelection() {
    const selection = window.getSelection()
    const text = selection?.toString()?.trim()
    
    if (text && text.length > 0) {
      selectedText = text
      notifyBackground({ type: 'TEXT_SELECTED', text: selectedText })
    }
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_CONTEXT') {
        const context = extractContext()
        sendResponse(context)
      } else if (message.type === 'GET_SELECTED_TEXT') {
        sendResponse({ text: selectedText })
      } else if (message.type === 'INSERT_TEXT') {
        insertTextAtCursor(message.text)
        sendResponse({ success: true })
      }
      return true
    })
  }

  function insertTextAtCursor(text) {
    if (!text) return;
    
    // Attempt standard document.execCommand first
    const success = document.execCommand('insertText', false, text);
    
    if (!success) {
      const activeElement = document.activeElement;
      
      if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
        const start = activeElement.selectionStart || 0;
        const end = activeElement.selectionEnd || 0;
        activeElement.value = activeElement.value.substring(0, start) + text + activeElement.value.substring(end);
        activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        activeElement.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // Dispatch Paste Event for rich text editors
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: new DataTransfer()
        });
        pasteEvent.clipboardData.setData('text/plain', text);
        
        if (activeElement) {
          activeElement.dispatchEvent(pasteEvent);
        } else {
          document.dispatchEvent(pasteEvent);
        }
      }
    }
  }

  function extractContext() {
    return {
      url: window.location.href,
      title: document.title,
      text: extractMainContent(),
      selectedText: selectedText,
      timestamp: Date.now()
    }
  }

  function extractMainContent() {
    const candidates = [
      document.querySelector('main'),
      document.querySelector('article'),
      document.querySelector('[role="main"]'),
      document.body
    ]

    let bestContent = ''
    let bestScore = 0

    for (const candidate of candidates) {
      if (!candidate) continue
      
      const content = extractTextFromElement(candidate)
      const score = calculateContentScore(content, candidate)
      
      if (score > bestScore) {
        bestScore = score
        bestContent = content
      }
    }

    return truncateText(bestContent, MAX_TEXT_LENGTH)
  }

  function extractTextFromElement(element) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement
          if (!parent) return NodeFilter.FILTER_REJECT
          
          if (EXCLUDED_TAGS.includes(parent.tagName)) {
            return NodeFilter.FILTER_REJECT
          }
          
          const className = parent.className?.toLowerCase() || ''
          const id = parent.id?.toLowerCase() || ''
          
          for (const excluded of EXCLUDED_CLASSES) {
            if (className.includes(excluded) || id.includes(excluded)) {
              return NodeFilter.FILTER_REJECT
            }
          }
          
          return NodeFilter.FILTER_ACCEPT
        }
      }
    )

    const textParts = []
    let node
    
    while (node = walker.nextNode()) {
      const text = node.textContent?.trim()
      if (text && text.length > 0) {
        textParts.push(text)
      }
    }

    return textParts.join(' ')
  }

  function calculateContentScore(text, element) {
    if (!text) return 0

    let score = text.length

    const paragraphs = element.querySelectorAll('p')
    score += paragraphs.length * 50

    const codeBlocks = element.querySelectorAll('pre, code')
    score += codeBlocks.length * 30

    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6')
    score += headings.length * 20

    const links = element.querySelectorAll('a')
    const linkDensity = links.length / (text.length / 100)
    if (linkDensity > 1) {
      score -= linkDensity * 10
    }

    return Math.max(0, score)
  }

  function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text
    
    const truncated = text.substring(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...'
    }
    
    return truncated + '...'
  }

  function notifyBackground(data) {
    try {
      chrome.runtime.sendMessage(data)
    } catch (error) {
      console.debug('AI Chat: Could not notify background:', error)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
