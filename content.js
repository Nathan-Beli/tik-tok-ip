// Script injecté sur la page TikTok pour capturer les IPs via WebRTC

(function() {
  console.log("[TikTok IP] Content script chargé");

  // Capture les connexions WebRTC qui ont déjà été créées
  let leakedIPs = [];

  function captureWebRTC() {
    try {
      const pc = new RTCPeerConnection({
        iceServers: []
      });

      pc.createDataChannel("ip-leak");
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && event.candidate.candidate) {
          const candidate = event.candidate.candidate;
          // Format: "candidate:... typ host ... 192.168.1.5 ..."
          // ou "candidate:... typ srflx ... 86.45.12.3 ..."
          const parts = candidate.split(" ");
          const ipIndex = parts.indexOf("raddr") + 1;

          let ip = null;
          if (parts.includes("host")) {
            // IP locale
            for (let i = 0; i < parts.length; i++) {
              if (parts[i] === "host" && i + 1 < parts.length) {
                ip = parts[i + 1];
                // Vérifie que c'est une IP valide
                if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
                  leakedIPs.push({
                    ip: ip,
                    type: "locale (privée)",
                    method: "WebRTC"
                  });
                }
                break;
              }
            }
          }

          if (parts.includes("srflx")) {
            // IP publique
            for (let i = 0; i < parts.length; i++) {
              if (parts[i] === "srflx" && i + 1 < parts.length) {
                ip = parts[i + 1];
                if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
                  leakedIPs.push({
                    ip: ip,
                    type: "publique",
                    method: "WebRTC"
                  });
                }
                break;
              }
            }
          }

          // Envoie à l'extension
          chrome.runtime.sendMessage({
            type: "webrtc_ip",
            data: leakedIPs
          });
        }
      };

      // Ferme proprement après 5 secondes
      setTimeout(() => {
        pc.close();
      }, 5000);

    } catch (e) {
      console.log("[TikTok IP] WebRTC non disponible ou bloqué");
    }
  }

  // Lance la capture WebRTC
  captureWebRTC();

  // Écoute aussi les connexions WebSocket de la page
  const originalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    if (url.includes("tiktok") || url.includes
