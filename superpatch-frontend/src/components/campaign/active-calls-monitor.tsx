"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PhoneCall,
  Radio,
  Headphones,
  Volume2,
  VolumeX,
  Clock,
  MapPin,
  User,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
  Square,
  PhoneOff,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRealtimeCallStatus, ActiveCall } from "@/hooks/useRealtimeCallStatus";
import { callNotifications } from "@/components/campaign/call-notifications";

// Format seconds to MM:SS or HH:MM:SS
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Live duration timer component
function LiveDuration({ startTime }: { startTime: string | null }) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const start = new Date(startTime).getTime();

    const updateDuration = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);
      setDuration(Math.max(0, elapsed));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className="font-mono tabular-nums text-sm">
      {formatDuration(duration)}
    </span>
  );
}

// Audio level visualizer
function AudioLevelIndicator({ level }: { level: number }) {
  const bars = 5;
  const activeThresholds = [0.1, 0.25, 0.45, 0.65, 0.85];

  return (
    <div className="flex items-end gap-0.5 h-4">
      {activeThresholds.map((threshold, i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-sm transition-all duration-75",
            level >= threshold ? "bg-green-500" : "bg-muted-foreground/20"
          )}
          style={{ height: `${((i + 1) / bars) * 100}%` }}
        />
      ))}
    </div>
  );
}

// Single active call card
function ActiveCallCard({
  call,
  onListen,
  isListening,
  onStop,
  isStopping = false,
}: {
  call: ActiveCall;
  onListen?: () => void;
  isListening: boolean;
  onStop?: () => void;
  isStopping?: boolean;
}) {
  const statusColors: Record<string, string> = {
    in_progress: "bg-green-500",
    queued: "bg-yellow-500",
  };
  const statusColor = statusColors[call.status] || "bg-muted";

  return (
    <div className="border rounded-lg p-3 bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("w-2 h-2 rounded-full animate-pulse", statusColor)} />
            <span className="font-medium truncate">{call.practitioner_name}</span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <User className="h-3 w-3" />
            <span>{call.practitioner_type || "Unknown"}</span>
          </div>
          
          {(call.city || call.province) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{[call.city, call.province].filter(Boolean).join(", ")}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <LiveDuration startTime={call.call_started_at} />
          </div>
          
          {call.status === "in_progress" && onListen && (
            <Button
              size="sm"
              variant={isListening ? "destructive" : "outline"}
              className="h-7 text-xs gap-1"
              onClick={onListen}
            >
              {isListening ? (
                <>
                  <Square className="h-3 w-3" />
                  Stop
                </>
              ) : (
                <>
                  <Headphones className="h-3 w-3" />
                  Listen
                </>
              )}
            </Button>
          )}

          {call.status === "in_progress" && onStop && call.call_id && (
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs gap-1"
              onClick={onStop}
              disabled={isStopping}
            >
              {isStopping ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <PhoneOff className="h-3 w-3" />
              )}
              Stop call
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Audio stream modal
function AudioStreamModal({
  isOpen,
  onClose,
  call,
}: {
  isOpen: boolean;
  onClose: () => void;
  call: ActiveCall | null;
}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Connect to audio stream
  const connect = useCallback(async () => {
    if (!call?.call_id) return;

    setIsConnecting(true);
    setError(null);

    try {
      // Get WebSocket URL from our API
      const response = await fetch(`/api/bland/calls/${call.call_id}/listen`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start listening session");
      }

      const { websocketUrl } = data;

      // Set up Web Audio API
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);

      // Connect to WebSocket
      const ws = new WebSocket(websocketUrl);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log("[AudioStream] Connected");
        setIsConnecting(false);
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!audioContextRef.current || !gainNodeRef.current) return;

        // Convert PCM Int16 to Float32 for Web Audio API
        const dataView = new DataView(event.data);
        const int16Array = new Int16Array(dataView.byteLength / 2);

        for (let i = 0; i < int16Array.length; i++) {
          int16Array[i] = dataView.getInt16(i * 2, true); // Little-endian
        }

        const float32Array = new Float32Array(int16Array.length);
        let maxLevel = 0;

        for (let i = 0; i < int16Array.length; i++) {
          const normalized = int16Array[i] / 32768;
          float32Array[i] = normalized;
          maxLevel = Math.max(maxLevel, Math.abs(normalized));
        }

        // Update audio level indicator
        setAudioLevel(maxLevel);

        // Create audio buffer and play
        const audioBuffer = audioContextRef.current.createBuffer(1, float32Array.length, 16000);
        audioBuffer.copyToChannel(float32Array, 0);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current);
        source.start();
      };

      ws.onerror = (event) => {
        console.error("[AudioStream] WebSocket error:", event);
        setError("Connection error");
      };

      ws.onclose = () => {
        console.log("[AudioStream] Disconnected");
        setIsConnected(false);
      };

    } catch (err) {
      console.error("[AudioStream] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
      setIsConnecting(false);
    }
  }, [call?.call_id]);

  // Disconnect from audio stream
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setAudioLevel(0);
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 1 : 0;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Auto-connect when modal opens
  useEffect(() => {
    if (isOpen && call?.call_id && !isConnected && !isConnecting) {
      connect();
    }
  }, [isOpen, call?.call_id, isConnected, isConnecting, connect]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      disconnect();
    }
  }, [isOpen, disconnect]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-green-500" />
            Live Call Monitor
          </DialogTitle>
          <DialogDescription>
            Listening to call with {call?.practitioner_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Call info */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{call?.practitioner_name}</span>
              <Badge variant="outline" className="text-xs">
                {call?.practitioner_type || "Unknown"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Duration: </span>
              <LiveDuration startTime={call?.call_started_at || null} />
            </div>
          </div>

          {/* Audio controls */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              {isConnecting ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : isConnected ? (
                <AudioLevelIndicator level={audioLevel} />
              ) : (
                <WifiOff className="h-6 w-6 text-muted-foreground" />
              )}
              
              <span className="text-sm">
                {isConnecting
                  ? "Connecting..."
                  : isConnected
                  ? "Streaming audio"
                  : "Disconnected"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isConnected && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={toggleMute}
                  className="h-8 w-8"
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
              )}

              {isConnected ? (
                <Button size="sm" variant="destructive" onClick={disconnect}>
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={connect}
                  disabled={isConnecting}
                >
                  {isConnecting ? "Connecting..." : "Connect"}
                </Button>
              )}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Note about live listen */}
          <p className="text-xs text-muted-foreground">
            Live listen must be enabled in your Bland.ai organization settings.
            Audio includes all participants in the call.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main component
interface ActiveCallsMonitorProps {
  className?: string;
  collapsed?: boolean;
}

export function ActiveCallsMonitor({ className, collapsed = false }: ActiveCallsMonitorProps) {
  const [listeningCallId, setListeningCallId] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<ActiveCall | null>(null);
  const [stoppingCallId, setStoppingCallId] = useState<string | null>(null);

  const { activeCalls, isConnected, error, refresh } = useRealtimeCallStatus({
    onCallStarted: (call) => {
      callNotifications.started(call.practitioner_name);
    },
    onCallCompleted: (call) => {
      callNotifications.completed(
        call.practitioner_name,
        call.duration_seconds || 0
      );
      // Close listen modal if this call completed
      if (listeningCallId === call.id) {
        setListeningCallId(null);
        setSelectedCall(null);
      }
    },
  });

  const inProgressCalls = activeCalls.filter((c) => c.status === "in_progress");
  const queuedCalls = activeCalls.filter((c) => c.status === "queued");

  const handleListen = (call: ActiveCall) => {
    if (listeningCallId === call.id) {
      setListeningCallId(null);
      setSelectedCall(null);
    } else {
      setSelectedCall(call);
      setListeningCallId(call.id);
    }
  };

  const handleStop = async (call: ActiveCall) => {
    if (!call.call_id || stoppingCallId) return;
    setStoppingCallId(call.id);
    try {
      const res = await fetch(`/api/bland/calls/${call.call_id}/stop`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Failed to stop call (${res.status})`);
      }
      toast.success("Call stopped");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to stop call");
    } finally {
      setStoppingCallId(null);
    }
  };

  if (collapsed) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )}
          />
          <PhoneCall className="h-4 w-4" />
          <span className="text-sm font-medium">{inProgressCalls.length}</span>
        </div>
        {queuedCalls.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {queuedCalls.length} queued
          </Badge>
        )}
      </div>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Radio className="h-4 w-4 text-green-500" />
              Active Calls
              <Badge variant="secondary" className="ml-1">
                {inProgressCalls.length}
              </Badge>
            </CardTitle>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {isConnected ? (
                  <Wifi className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-red-500" />
                )}
                <span>{isConnected ? "Live" : "Disconnected"}</span>
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={refresh}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive mb-3">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {activeCalls.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <PhoneCall className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active calls</p>
              <p className="text-xs">Calls will appear here in real-time</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-2">
              <div className="space-y-2">
                {/* In Progress calls first */}
                {inProgressCalls.map((call) => (
                  <ActiveCallCard
                    key={call.id}
                    call={call}
                    onListen={() => handleListen(call)}
                    isListening={listeningCallId === call.id}
                    onStop={() => handleStop(call)}
                    isStopping={stoppingCallId === call.id}
                  />
                ))}

                {/* Queued calls */}
                {queuedCalls.length > 0 && (
                  <>
                    {inProgressCalls.length > 0 && (
                      <div className="text-xs text-muted-foreground font-medium py-2">
                        Queued ({queuedCalls.length})
                      </div>
                    )}
                    {queuedCalls.map((call) => (
                      <ActiveCallCard
                        key={call.id}
                        call={call}
                        isListening={false}
                      />
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Audio stream modal */}
      <AudioStreamModal
        isOpen={listeningCallId !== null}
        onClose={() => {
          setListeningCallId(null);
          setSelectedCall(null);
        }}
        call={selectedCall}
      />
    </>
  );
}

export default ActiveCallsMonitor;
