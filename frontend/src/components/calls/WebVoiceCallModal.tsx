import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Volume2,
  Radio,
  AlertCircle,
  X,
  RefreshCw,
  Bot,
  User,
  Clock,
} from 'lucide-react';
import { RetellWebClient } from 'retell-client-js-sdk';
import { callApi, Call, TranscriptTurn } from '../../api/call.api';
import { Agent } from '../../api/agent.api';
import { useToast } from '../../context/ToastContext';

export interface WebVoiceCallModalProps {
  isOpen: boolean;
  agent: Agent | null;
  onClose: () => void;
  onCallCompleted?: (call: Call) => void;
}

export type WebCallConnectionState =
  | 'idle'
  | 'requesting_mic'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'failed';

export const WebVoiceCallModal: React.FC<WebVoiceCallModalProps> = ({
  isOpen,
  agent,
  onClose,
  onCallCompleted,
}) => {
  const { success, error, warning } = useToast();

  const [connectionState, setConnectionState] = useState<WebCallConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState<boolean>(false);
  const [userMicVolume, setUserMicVolume] = useState<number>(0);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState<boolean>(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [liveTranscripts, setLiveTranscripts] = useState<TranscriptTurn[]>([]);
  const [syncingCall, setSyncingCall] = useState<boolean>(false);

  const retellClientRef = useRef<RetellWebClient | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  activeCallRef.current = activeCall;

  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);

  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setConnectionState('idle');
      setErrorMessage(null);
      setMicPermissionDenied(false);
      setIsMuted(false);
      setIsAgentSpeaking(false);
      setUserMicVolume(0);
      setAudioPlaybackBlocked(false);
      setDurationSeconds(0);
      setActiveCall(null);
      setLiveTranscripts([]);
      setSyncingCall(false);
    } else {
      // Clean up if closed
      cleanupCallSession();
    }
  }, [isOpen]);

  // Call duration timer
  useEffect(() => {
    if (connectionState === 'connected') {
      timerRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [connectionState]);

  const cleanupCallSession = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
    if (micAudioCtxRef.current) {
      try {
        micAudioCtxRef.current.close();
      } catch {}
      micAudioCtxRef.current = null;
    }
    micAnalyserRef.current = null;
    setUserMicVolume(0);
    setAudioPlaybackBlocked(false);

    if (retellClientRef.current) {
      try {
        const transportAudio = (retellClientRef.current as any)?.transport?.audioEl;
        if (transportAudio && document.body.contains(transportAudio)) {
          document.body.removeChild(transportAudio);
        }
        retellClientRef.current.stopCall();
      } catch (e) {
        console.warn('Error stopping Retell call:', e);
      }
      retellClientRef.current = null;
    }
  };

  const handleManualAudioPlaybackUnlock = async () => {
    try {
      console.log('[WebVoiceCallModal] Manual audio playback unlock invoked by user click');
      if (retellClientRef.current) {
        await retellClientRef.current.startAudioPlayback();
      }
      if (remoteAudioRef.current) {
        await remoteAudioRef.current.play();
      }
      const transportAudio = (retellClientRef.current as any)?.transport?.audioEl;
      if (transportAudio) {
        await transportAudio.play();
      }
      setAudioPlaybackBlocked(false);
      success('Audio playback resumed successfully', 'Sound Unmuted');
    } catch (err: any) {
      console.warn('[WebVoiceCallModal] Manual audio playback unlock notice:', err);
    }
  };

  /**
   * Prominently start real browser voice conversation
   */
  const handleStartConversation = async () => {
    if (!agent) {
      error('Please select an active voice agent first.');
      return;
    }

    setErrorMessage(null);
    setMicPermissionDenied(false);
    setConnectionState('requesting_mic');

    // 1. Request microphone access with user-friendly error handling
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (micErr: any) {
      console.error('Microphone access denied or unavailable:', micErr);
      setMicPermissionDenied(true);
      setConnectionState('failed');
      const denialMessage =
        micErr.name === 'NotAllowedError' ||
        micErr.name === 'PermissionDeniedError' ||
        micErr.message?.toLowerCase().includes('permission denied')
          ? 'Microphone permission was denied. Please allow microphone access in your browser site permissions to speak with the agent.'
          : micErr.name === 'NotFoundError'
          ? 'No microphone input device was detected on your device.'
          : `Microphone initialization error: ${micErr.message || 'Access rejected'}`;
      setErrorMessage(denialMessage);
      error(denialMessage, 'Microphone Permission Required');
      return;
    }

    // Pre-warm browser audio subsystem in direct user gesture context to avoid autoplay restrictions
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const prewarmCtx = new AudioCtx();
        if (prewarmCtx.state === 'suspended') {
          await prewarmCtx.resume();
        }
      }
    } catch (e) {
      console.debug('[WebVoiceCallModal] AudioContext pre-warming:', e);
    }

    // 2. Request browser WebRTC access token from backend API
    setConnectionState('connecting');

    try {
      const res = await callApi.startWebCall({
        agentId: agent.id,
        dynamicVariables: {
          client_source: 'browser_webrtc_interface',
        },
      });

      console.log('[WebVoiceCallModal] Backend session created:', {
        callId: res.call.id,
        providerCallId: res.providerCallId,
        transport: res.transport,
        iceServersCount: res.iceServers?.length ?? 0,
        hasAccessToken: Boolean(res.accessToken),
      });

      const { call, accessToken, providerCallId, transport, iceServers } = res;
      setActiveCall(call);

      // If mock token (MOCK mode active)
      if (accessToken.startsWith('mock_')) {
        setTimeout(() => {
          setConnectionState('connected');
          setDurationSeconds(0);
          setLiveTranscripts([
            {
              role: 'agent',
              content: `Hello! I am ${agent.name} running in local simulation mode. Real voice conversation uses Retell Live mode.`,
            },
          ]);
          warning(
            'Running in MOCK mode. Provider is simulated; real voice audio streams when provider mode is LIVE.',
            'MOCK Simulation'
          );
        }, 1200);
        return;
      }

      // 3. Initialize official Retell Web Client with the provider's transport
      const client = new RetellWebClient({
        defaultTransport: transport || 'gateway',
      });
      retellClientRef.current = client;

      // Event: call_started (WebRTC connection established)
      client.on('call_started', () => {
        console.log('[RetellWebClient] WebRTC connection established (call_started)');
        setConnectionState('connected');
        setDurationSeconds(0);
        success('Connected to Shiavnski AI voice agent. Start speaking!', 'Call Connected');

        // Hook up user microphone volume analyzer from localStream
        try {
          const localStream = (client as any)?.transport?.localStream;
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (localStream && AudioCtx) {
            const ctx = new AudioCtx();
            micAudioCtxRef.current = ctx;
            const source = ctx.createMediaStreamSource(localStream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            micAnalyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const checkVolume = () => {
              if (!retellClientRef.current) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              setUserMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
              micAnimFrameRef.current = requestAnimationFrame(checkVolume);
            };
            micAnimFrameRef.current = requestAnimationFrame(checkVolume);
          }
        } catch (e) {
          console.debug('[WebVoiceCallModal] Mic analyser setup notice:', e);
        }
      });

      // Event: call_ready (Remote audio track attached and ready for playback)
      client.on('call_ready', async () => {
        console.log('[RetellWebClient] Remote audio track attached and ready (call_ready)');
        try {
          const transport = (client as any)?.transport;
          if (transport?.audioEl) {
            if (!document.body.contains(transport.audioEl)) {
              transport.audioEl.id = 'retell-remote-audio-gateway';
              transport.audioEl.style.display = 'none';
              document.body.appendChild(transport.audioEl);
            }
          }
          if (remoteAudioRef.current && transport?.audioEl?.srcObject) {
            remoteAudioRef.current.srcObject = transport.audioEl.srcObject;
            remoteAudioRef.current.play().catch((playErr) => {
              console.warn('[WebVoiceCallModal] DOM audio play blocked:', playErr);
              setAudioPlaybackBlocked(true);
            });
          }
          await client.startAudioPlayback();
          console.log('[RetellWebClient] Audio playback actively started/resumed');
        } catch (audioErr) {
          console.warn('[RetellWebClient] Audio playback auto-start warning:', audioErr);
          setAudioPlaybackBlocked(true);
        }
      });

      // Event: agent_start_talking
      client.on('agent_start_talking', () => {
        console.log('[RetellWebClient] Agent started talking');
        setIsAgentSpeaking(true);
      });

      // Event: agent_stop_talking
      client.on('agent_stop_talking', () => {
        console.log('[RetellWebClient] Agent stopped talking');
        setIsAgentSpeaking(false);
      });

      // Event: audio (Raw remote audio sample buffer from Retell AI agent)
      client.on('audio', (dataArray: Float32Array) => {
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        if (rms > 0.012) {
          setIsAgentSpeaking(true);
        }
      });

      // Event: update (transcript and speaker updates)
      client.on('update', (update: any) => {
        console.log('[RetellWebClient] Live transcript update:', update);
        if (update?.transcript && Array.isArray(update.transcript)) {
          const formatted: TranscriptTurn[] = update.transcript.map((item: any) => ({
            role: item.role === 'agent' ? 'agent' : 'user',
            content: item.content || '',
            words: item.words,
          }));
          setLiveTranscripts(formatted);
        }
      });

      // Event: error
      client.on('error', (err: any) => {
        console.error('[RetellWebClient] Error event:', err);
        setConnectionState('failed');
        const errStr = typeof err === 'string' ? err : err?.message || 'Voice connection interrupted';
        setErrorMessage(errStr);
        error(errStr, 'Connection Error');
        cleanupCallSession();
      });

      // Event: call_ended
      client.on('call_ended', async () => {
        console.log('[RetellWebClient] Call ended event received from SDK');
        await handleEndConversation();
      });

      // 4. Start the real Retell WebRTC session with the COMPLETE configuration
      const resolvedCallId = providerCallId || call.providerCallId;
      const startConfig = {
        accessToken,
        transport: (transport as any) || 'gateway',
        callId: resolvedCallId,
        iceServers: iceServers as any,
        emitRawAudioSamples: true,
      };

      console.log('[RetellWebClient] Calling startCall with config:', {
        transport: startConfig.transport,
        callId: startConfig.callId,
        hasIceServers: Boolean(startConfig.iceServers?.length),
        hasAccessToken: Boolean(startConfig.accessToken),
      });

      await client.startCall(startConfig);
      console.log('[RetellWebClient] startCall returned successfully');
    } catch (err: any) {
      console.error('[WebVoiceCallModal] Failed to initiate web call:', err);
      setConnectionState('failed');
      const isMicDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.message?.toLowerCase().includes('permission denied') ||
        err?.message?.toLowerCase().includes('not allowed');

      if (isMicDenied) {
        setMicPermissionDenied(true);
        const denialMsg =
          'Microphone permission was denied. Please allow microphone access in your browser site permissions to speak with the agent.';
        setErrorMessage(denialMsg);
        error(denialMsg, 'Microphone Permission Required');
      } else {
        const msg = err?.response?.data?.message || err?.message || 'Failed to start voice conversation';
        setErrorMessage(msg);
        error(msg, 'Call Initiation Failed');
      }
      cleanupCallSession();
    }
  };

  /**
   * Prominently end voice conversation
   */
  const handleEndConversation = async () => {
    setConnectionState('ended');
    setIsAgentSpeaking(false);
    cleanupCallSession();

    const targetCall = activeCallRef.current || activeCall;
    if (targetCall) {
      try {
        if (typeof callApi?.endCall === 'function') {
          const ended = await Promise.resolve(callApi.endCall(targetCall.id, durationSeconds));
          if (ended) {
            setActiveCall(ended);
            onCallCompleted?.(ended);
          }
        }
      } catch (err) {
        console.warn('Backend endCall notice:', err);
      }
      triggerCallSync(targetCall.id);
    }
  };

  /**
   * Trigger multi-stage backend sync to retrieve latest transcript & recording
   * after provider finishes audio recording upload and LLM post-call analysis.
   */
  const triggerCallSync = async (callId: string) => {
    try {
      setSyncingCall(true);
      const synced = await callApi.syncCall(callId);
      if (synced) {
        setActiveCall(synced);
        if (synced.transcriptObject && Array.isArray(synced.transcriptObject)) {
          setLiveTranscripts(synced.transcriptObject);
        }
        onCallCompleted?.(synced);
      }

      // If recording or transcript is still processing on provider, schedule follow-up retries
      if (!synced?.recordingUrl || !synced?.transcriptText) {
        setTimeout(async () => {
          try {
            const retry1 = await callApi.syncCall(callId);
            if (retry1) {
              setActiveCall(retry1);
              if (retry1.transcriptObject && Array.isArray(retry1.transcriptObject)) {
                setLiveTranscripts(retry1.transcriptObject);
              }
              onCallCompleted?.(retry1);
            }

            if (!retry1?.recordingUrl || !retry1?.transcriptText) {
              setTimeout(async () => {
                try {
                  const retry2 = await callApi.syncCall(callId);
                  if (retry2) {
                    setActiveCall(retry2);
                    if (retry2.transcriptObject && Array.isArray(retry2.transcriptObject)) {
                      setLiveTranscripts(retry2.transcriptObject);
                    }
                    onCallCompleted?.(retry2);
                  }
                } catch {}
              }, 4000);
            }
          } catch {}
        }, 2000);
      }
    } catch (e) {
      console.warn('Call sync after end completed with notice:', e);
    } finally {
      setSyncingCall(false);
    }
  };

  /**
   * Safe modal close: ensure call is terminated if active
   */
  const handleModalClose = () => {
    if (connectionState === 'connected' || connectionState === 'connecting') {
      handleEndConversation();
    } else {
      cleanupCallSession();
    }
    onClose();
  };

  /**
   * Toggle microphone mute / unmute
   */
  const handleToggleMute = () => {
    if (!retellClientRef.current) return;
    if (isMuted) {
      retellClientRef.current.unmute();
      setIsMuted(false);
    } else {
      retellClientRef.current.mute();
      setIsMuted(true);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="webcall-modal-title"
    >
      <div className="w-full max-w-xl bg-[#0B111D] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 animate-fade-in relative flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="webcall-modal-title" className="text-lg font-bold text-white tracking-tight">
                  Browser Voice Conversation
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    connectionState === 'connected'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse'
                      : connectionState === 'connecting' || connectionState === 'requesting_mic'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse'
                      : connectionState === 'ended'
                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                      : connectionState === 'failed'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  {connectionState === 'requesting_mic'
                    ? 'Requesting Mic'
                    : connectionState === 'connecting'
                    ? 'Connecting'
                    : connectionState === 'connected'
                    ? 'Connected • Live'
                    : connectionState === 'ended'
                    ? 'Call Ended'
                    : connectionState === 'failed'
                    ? 'Connection Failed'
                    : 'Ready'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {agent?.name || 'Shiavnski AI Assistant'} • WebRTC Real-Time Audio
              </p>
            </div>
          </div>

          <button
            onClick={handleModalClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Microphone Permission Warning / Actionable Guide */}
          {micPermissionDenied && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Microphone Permission Denied</span>
              </div>
              <p className="leading-relaxed">
                Your browser blocked microphone access. To talk with the voice agent:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-rose-300/90 pl-1 font-mono text-[11px]">
                <li>Click the lock/settings icon in your browser URL bar.</li>
                <li>Find <strong>Microphone</strong> permissions and select <strong>Allow</strong>.</li>
                <li>Refresh or click <strong>Retry Connection</strong> below.</li>
              </ol>
            </div>
          )}

          {/* General Connection Failure Alert */}
          {errorMessage && !micPermissionDenied && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Session Error</p>
                <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Audio Autoplay Blocked Banner */}
          {audioPlaybackBlocked && (
            <button
              type="button"
              onClick={handleManualAudioPlaybackUnlock}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-amber-500/30 transition-all animate-bounce"
            >
              <Volume2 className="w-4 h-4 text-amber-400" />
              <span>Browser paused audio playback — Click here to unmute AI voice</span>
            </button>
          )}

          {/* Central Interactive Voice Orb & Status Card */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 flex flex-col items-center justify-center text-center space-y-4">
            {/* Visualizer Orb */}
            <div className="relative flex items-center justify-center my-2">
              {/* Outer pulsing rings when active */}
              {connectionState === 'connected' && (
                <>
                  <div
                    className={`absolute w-36 h-36 rounded-full transition-all duration-300 ${
                      isAgentSpeaking
                        ? 'bg-blue-500/20 animate-ping'
                        : 'bg-emerald-500/15 animate-pulse'
                    }`}
                  />
                  <div
                    className={`absolute w-28 h-28 rounded-full transition-all duration-300 ${
                      isAgentSpeaking ? 'bg-blue-500/30' : 'bg-emerald-500/20'
                    }`}
                  />
                </>
              )}

              {/* Center Voice Icon */}
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl relative z-10 ${
                  connectionState === 'connected'
                    ? isAgentSpeaking
                      ? 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-blue-500/40 scale-105'
                      : isMuted
                      ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 shadow-amber-500/20'
                      : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-500/30'
                    : connectionState === 'connecting' || connectionState === 'requesting_mic'
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {connectionState === 'connected' ? (
                  isAgentSpeaking ? (
                    <Volume2 className="w-9 h-9 animate-bounce" />
                  ) : isMuted ? (
                    <MicOff className="w-9 h-9" />
                  ) : (
                    <Mic className="w-9 h-9" />
                  )
                ) : (
                  <Bot className="w-9 h-9" />
                )}
              </div>
            </div>

            {/* Speaking / Audio State Banner */}
            <div>
              <p className="text-base font-bold text-white">
                {connectionState === 'connected'
                  ? isAgentSpeaking
                    ? `${agent?.name || 'Agent'} is speaking...`
                    : isMuted
                    ? 'Your microphone is muted'
                    : 'Listening to your voice... Speak anytime'
                  : connectionState === 'connecting'
                  ? 'Establishing secure WebRTC voice channel...'
                  : connectionState === 'requesting_mic'
                  ? 'Requesting browser microphone permissions...'
                  : connectionState === 'ended'
                  ? 'Conversation ended'
                  : connectionState === 'failed'
                  ? 'Voice session terminated'
                  : 'Ready to converse through browser microphone'}
              </p>

              {connectionState === 'connected' && (
                <div className="flex items-center justify-center gap-2 mt-1.5 text-xs text-slate-400 font-mono">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Call Duration: {formatDuration(durationSeconds)}</span>
                </div>
              )}

              {/* Live Mic Activity / VU meter */}
              {connectionState === 'connected' && !isMuted && (
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 mt-2 mx-auto">
                  <div
                    className={`w-2 h-2 rounded-full transition-all ${
                      userMicVolume > 8 ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                    }`}
                  />
                  <span className="text-[11px] text-slate-300 font-mono">
                    {userMicVolume > 8 ? 'Capturing voice' : 'Mic active (listening)'}
                  </span>
                  <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-75"
                      style={{ width: `${Math.max(6, userMicVolume)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Primary Control Buttons */}
            <div className="flex items-center justify-center gap-3 pt-2 w-full max-w-sm">
              {connectionState !== 'connected' && connectionState !== 'connecting' && connectionState !== 'requesting_mic' ? (
                /* Prominent START VOICE CONVERSATION BUTTON */
                <button
                  type="button"
                  id="start-voice-conversation-btn"
                  onClick={handleStartConversation}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-600/30 transition-all hover:scale-[1.02]"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Start Voice Conversation</span>
                </button>
              ) : (
                /* Prominent END CALL BUTTON + MUTE TOGGLE */
                <>
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`px-4 py-3 rounded-2xl text-xs font-semibold border transition-all flex items-center gap-2 ${
                      isMuted
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                    }`}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="w-4 h-4 text-amber-400" /> Unmute
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 text-emerald-400" /> Mute
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    id="end-call-btn"
                    onClick={handleEndConversation}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-rose-600/30 transition-all hover:scale-[1.02]"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>End Call</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Real-Time Transcript Stream */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Live Conversation Transcript
              </span>
              {syncingCall && (
                <span className="text-[10px] text-blue-400 flex items-center gap-1 font-mono">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Syncing analysis...
                </span>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 max-h-52 overflow-y-auto space-y-3 font-sans text-xs">
              {liveTranscripts.length === 0 ? (
                <p className="text-slate-500 italic text-center py-4">
                  {connectionState === 'connected'
                    ? 'Speak into your microphone. Words will appear here in real-time.'
                    : 'Transcripts appear here as you speak with the agent.'}
                </p>
              ) : (
                liveTranscripts.map((turn, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 ${
                      turn.role === 'agent' ? 'text-blue-300' : 'text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                        turn.role === 'agent'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {turn.role === 'agent' ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    </div>
                    <div>
                      <span className="font-semibold text-[10px] uppercase tracking-wider block text-slate-400">
                        {turn.role === 'agent' ? agent?.name || 'Agent' : 'You'}
                      </span>
                      <p className="leading-relaxed mt-0.5">{turn.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Session Details Footer Info */}
          {activeCall && (
            <div className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex items-center justify-between text-xs text-slate-400 font-mono">
              <div className="truncate">
                <span className="text-slate-500">Call ID: </span>
                <span className="text-slate-300">{activeCall.id}</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold">
                Browser Web Call
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            <span>Retell WebRTC • Zero Phone Credits</span>
          </div>

          <button
            type="button"
            onClick={handleModalClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
          >
            Close Window
          </button>
        </div>

        {/* Hidden remote audio element to ensure audio pipeline binding */}
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      </div>
    </div>
  );
};

export default WebVoiceCallModal;
