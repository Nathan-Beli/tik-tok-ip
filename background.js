let debuggee = null;
let capturedIPs = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "start_capture") {
    startCapture();
  } else if (message.action === "stop_capture") {
    stopCapture();
  } else if (message.action === "get_ips") {
    sendResponse({ ips: capturedIPs });
  }
});

async function startCapture() {
  // Récupère l'onglet actif (TikTok)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url.includes("tiktok.com")) return;

  debuggee = { tabId: tab.id };

  try {
    // Attache le debugger (comme ouvrir F12)
    await chrome.debugger.attach(debuggee, "1.3");

    // Active les events réseau
    await chrome.debugger.sendCommand(debuggee, "Network.enable");

    console.log("Debugger attaché, capture réseau activée");

    // Écoute les events de requêtes réseau
    chrome.debugger.onEvent.addListener(onDebuggerEvent);

    // Stop automatique après 60 secondes
    setTimeout(stopCapture, 60000);

  } catch (e) {
    console.error("Erreur debugger:", e);
  }
}

function onDebuggerEvent(source, method, params) {
  if (method === "Network.requestWillBeSent") {
    const req = params.request;
    const url = req.url;

    // On filtre sur les URLs qui ressemblent à du live TikTok
    if (url.includes("pull") || url.includes("live") || url.includes("stream") || url.includes("ws") || url.includes("wss")) {
      const ip = extractIP(url);
      if (ip && !capturedIPs.some(i => i.ip === ip)) {
        capturedIPs.push({
          ip: ip,
          url: url.substring(0, 80),
          time: new Date().toLocaleTimeString()
        });
        // Notifier la popup si elle est ouverte
        chrome.runtime.sendMessage({ type: "new_ip", data: capturedIPs });
      }
    }
  }

  // Les réponses contiennent souvent l'IP réelle
  if (method === "Network.responseReceived") {
    const response = params.response;
    const remoteAddr = response.remoteIPAddress;
    if (remoteAddr) {
      const url = response.url;
      if ((url.includes("tiktok") || url.includes("pull") || url.includes("live")) &&
          !capturedIPs.some(i => i.ip === remoteAddr)) {
        capturedIPs.push({
          ip: remoteAddr,
          url: url.substring(0, 80),
          port: response.remotePort,
          time: new Date().toLocaleTimeString()
        });
        chrome.runtime.sendMessage({ type: "new_ip", data: capturedIPs });
      }
    }
  }

  // WebSocket (WebRTC inclut souvent des WS)
  if (method === "Network.webSocketCreated") {
    const url = params.url;
    if (url.includes("tiktok") || url.includes("live")) {
      capturedIPs.push({
        ip: "(WebSocket ouvert)",
        url: url.substring(0, 80),
        time: new Date().toLocaleTimeString()
      });
    }
  }
}

function stopCapture() {
  if (debuggee) {
    chrome.debugger.detach(debuggee);
    debuggee = null;
  }
}

function extractIP(url) {
  try {
    const u = new URL(url);
    // Essaie de trouver une IP dans l'hostname
    const hostname = u.hostname;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return hostname;
    }
    // Sinon résout le hostname (pas possible directement ici, 
    // mais on utilise l'IP de la réponse reçue)
    return null;
  } catch {
    return null;
  }
}
