import { useRef, useCallback, useEffect } from 'react';
import { useCall } from '../context/CallContext';

export default function useWebRTC(remoteVideoRef) {
  const pcRef = useRef(null);
  const { callState, sendSDPAnswer, sendICECandidate } = useCall();

  const setupWebRTC = useCallback(async (streamData) => {
    if (!streamData) return;

    try {
      const pc = new RTCPeerConnection({
        iceServers: streamData.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      pcRef.current = pc;

      // Remote stream → video element
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // ICE candidates → server → D-ID
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendICECandidate(event.candidate);
        }
      };

      // Connection state logging
      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
      };

      // Set remote description (D-ID's offer)
      await pc.setRemoteDescription(new RTCSessionDescription(streamData.offer));

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer to server → D-ID
      sendSDPAnswer(answer);

    } catch (err) {
      console.error('[WebRTC] Setup error:', err);
    }
  }, [remoteVideoRef, sendSDPAnswer, sendICECandidate]);

  // When stream data arrives, set up WebRTC
  useEffect(() => {
    if (callState.streamData && !pcRef.current) {
      setupWebRTC(callState.streamData);
    }
  }, [callState.streamData, setupWebRTC]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, []);

  return { pcRef };
}
