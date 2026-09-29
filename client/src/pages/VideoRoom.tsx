import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

interface VideoRoomProps {
  meetingId: string;
  onLeave: () => void;
}

function VideoRoom({
  meetingId,
  onLeave,
}: VideoRoomProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const peerConnectionRef =
    useRef<RTCPeerConnection | null>(null);

  const channelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  const localStreamRef =
    useRef<MediaStream | null>(null);

  const userIdRef = useRef<string>("");

  const [stream, setStream] =
    useState<MediaStream | null>(null);

  const [cameraEnabled, setCameraEnabled] =
    useState(true);

  const [micEnabled, setMicEnabled] =
    useState(true);

  const [error, setError] = useState("");

  const [connected, setConnected] =
    useState(false);

  // --------------------------------
  // START VIDEO CALL
  // --------------------------------

  useEffect(() => {
    let mounted = true;

    const startVideoCall = async () => {
      try {
        // Get logged-in user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("You are not logged in.");
          return;
        }

        userIdRef.current = user.id;

        // Get camera + microphone
        const mediaStream =
          await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });

        if (!mounted) {
          mediaStream
            .getTracks()
            .forEach((track) => track.stop());

          return;
        }

        localStreamRef.current = mediaStream;
        setStream(mediaStream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject =
            mediaStream;
        }

        // --------------------------------
        // CREATE PEER CONNECTION
        // --------------------------------

        const peerConnection =
          new RTCPeerConnection({
            iceServers: [
              {
                urls: "stun:stun.l.google.com:19302",
              },
              {
                urls: "stun:stun1.l.google.com:19302",
              },
            ],
          });

        peerConnectionRef.current =
          peerConnection;

        // Add local tracks
        mediaStream
          .getTracks()
          .forEach((track) => {
            peerConnection.addTrack(
              track,
              mediaStream
            );
          });

        // --------------------------------
        // RECEIVE REMOTE VIDEO
        // --------------------------------

        peerConnection.ontrack = (event) => {
          console.log(
            "Remote track received"
          );

          const [remoteStream] =
            event.streams;

          if (
            remoteVideoRef.current &&
            remoteStream
          ) {
            remoteVideoRef.current.srcObject =
              remoteStream;

            setConnected(true);
          }
        };

        // --------------------------------
        // ICE CANDIDATES
        // --------------------------------

        peerConnection.onicecandidate = (
          event
        ) => {
          if (
            event.candidate &&
            channelRef.current
          ) {
            channelRef.current.send({
              type: "broadcast",
              event: "ice-candidate",
              payload: {
                candidate: event.candidate,
                senderId: userIdRef.current,
              },
            });
          }
        };

        // --------------------------------
        // SUPABASE REALTIME CHANNEL
        // --------------------------------

        const channel =
          supabase.channel(
            `video-room-${meetingId}`
          );

        channelRef.current = channel;

        // --------------------------------
        // RECEIVE OFFER
        // --------------------------------

        channel.on(
          "broadcast",
          {
            event: "offer",
          },
          async ({ payload }) => {
            if (
              payload.senderId ===
              userIdRef.current
            ) {
              return;
            }

            console.log(
              "Offer received"
            );

            const pc =
              peerConnectionRef.current;

            if (!pc) return;

            try {
              await pc.setRemoteDescription(
                new RTCSessionDescription(
                  payload.offer
                )
              );

              const answer =
                await pc.createAnswer();

              await pc.setLocalDescription(
                answer
              );

              channel.send({
                type: "broadcast",
                event: "answer",
                payload: {
                  answer,
                  senderId:
                    userIdRef.current,
                },
              });
            } catch (err) {
              console.error(
                "Error handling offer:",
                err
              );
            }
          }
        );

        // --------------------------------
        // RECEIVE ANSWER
        // --------------------------------

        channel.on(
          "broadcast",
          {
            event: "answer",
          },
          async ({ payload }) => {
            if (
              payload.senderId ===
              userIdRef.current
            ) {
              return;
            }

            console.log(
              "Answer received"
            );

            const pc =
              peerConnectionRef.current;

            if (!pc) return;

            try {
              await pc.setRemoteDescription(
                new RTCSessionDescription(
                  payload.answer
                )
              );
            } catch (err) {
              console.error(
                "Error handling answer:",
                err
              );
            }
          }
        );

        // --------------------------------
        // RECEIVE ICE CANDIDATE
        // --------------------------------

        channel.on(
          "broadcast",
          {
            event: "ice-candidate",
          },
          async ({ payload }) => {
            if (
              payload.senderId ===
              userIdRef.current
            ) {
              return;
            }

            const pc =
              peerConnectionRef.current;

            if (!pc) return;

            try {
              await pc.addIceCandidate(
                new RTCIceCandidate(
                  payload.candidate
                )
              );
            } catch (err) {
              console.error(
                "Error adding ICE candidate:",
                err
              );
            }
          }
        );

        // --------------------------------
        // USER JOINED
        // --------------------------------

        channel.on(
          "broadcast",
          {
            event: "user-joined",
          },
          async ({ payload }) => {
            if (
              payload.userId ===
              userIdRef.current
            ) {
              return;
            }

            console.log(
              "Another user joined:",
              payload.userId
            );

            /*
              Only one user creates the offer.

              Comparing IDs prevents both users
              from creating an offer at the same time.
            */

            if (
              userIdRef.current <
              payload.userId
            ) {
              console.log(
                "I will create the offer."
              );

              const pc =
                peerConnectionRef.current;

              if (!pc) return;

              try {
                const offer =
                  await pc.createOffer();

                await pc.setLocalDescription(
                  offer
                );

                channel.send({
                  type: "broadcast",
                  event: "offer",
                  payload: {
                    offer,
                    senderId:
                      userIdRef.current,
                  },
                });
              } catch (err) {
                console.error(
                  "Error creating offer:",
                  err
                );
              }
            }
          }
        );

        // --------------------------------
        // SUBSCRIBE
        // --------------------------------

        channel.subscribe(
          async (status) => {
            console.log(
              "Realtime status:",
              status
            );

            if (status === "SUBSCRIBED") {
              console.log(
                "Connected to video room."
              );

              // Tell other users we joined
              await channel.send({
                type: "broadcast",
                event: "user-joined",
                payload: {
                  userId:
                    userIdRef.current,
                },
              });
            }
          }
        );
      } catch (err) {
        console.error(
          "Video call error:",
          err
        );

        setError(
          "Could not access camera or microphone. Please allow permissions."
        );
      }
    };

    startVideoCall();

    // --------------------------------
    // CLEANUP
    // --------------------------------

    return () => {
      mounted = false;

      console.log(
        "Leaving video room..."
      );

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "user-left",
          payload: {
            userId:
              userIdRef.current,
          },
        });

        supabase.removeChannel(
          channelRef.current
        );

        channelRef.current = null;
      }

      if (
        peerConnectionRef.current
      ) {
        peerConnectionRef.current.close();

        peerConnectionRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        localStreamRef.current = null;
      }
    };
  }, [meetingId]);

  // --------------------------------
  // TOGGLE CAMERA
  // --------------------------------

  const toggleCamera = () => {
    if (!stream) return;

    const videoTracks =
      stream.getVideoTracks();

    videoTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });

    setCameraEnabled(
      (previous) => !previous
    );
  };

  // --------------------------------
  // TOGGLE MICROPHONE
  // --------------------------------

  const toggleMic = () => {
    if (!stream) return;

    const audioTracks =
      stream.getAudioTracks();

    audioTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });

    setMicEnabled(
      (previous) => !previous
    );
  };

  // --------------------------------
  // LEAVE MEETING
  // --------------------------------

  const leaveMeeting = () => {
    if (stream) {
      stream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );
    }

    if (
      peerConnectionRef.current
    ) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    onLeave();
  };

  // --------------------------------
  // UI
  // --------------------------------

  return (
    <div className="video-room">
      <header className="video-room-header">
        <div>
          <h1>Video Call</h1>

          <p>
            Meeting ID:{" "}
            <strong>{meetingId}</strong>
          </p>

          <p>
            Status:{" "}
            <strong>
              {connected
                ? "🟢 Connected"
                : "🟡 Waiting for participant..."}
            </strong>
          </p>
        </div>

        <button onClick={leaveMeeting}>
          Leave Call
        </button>
      </header>

      {error && (
        <div className="video-error">
          {error}
        </div>
      )}

      <main className="video-room-content">
        <div className="video-grid">

          {/* LOCAL VIDEO */}
          <div className="video-container">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
            />

            {!cameraEnabled && (
              <div className="camera-off">
                Camera Off
              </div>
            )}

            <div className="participant-name">
              You
            </div>
          </div>

          {/* REMOTE VIDEO */}
          <div className="video-container">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
            />

            {!connected && (
              <div className="waiting">
                Waiting for another participant...
              </div>
            )}

            <div className="participant-name">
              Participant
            </div>
          </div>

        </div>
      </main>

      <footer className="video-controls">
        <button onClick={toggleMic}>
          {micEnabled
            ? "🎤 Mute"
            : "🔇 Unmute"}
        </button>

        <button onClick={toggleCamera}>
          {cameraEnabled
            ? "📷 Camera Off"
            : "📷 Camera On"}
        </button>

        <button
          className="leave-button"
          onClick={leaveMeeting}
        >
          📞 Leave
        </button>
      </footer>
    </div>
  );
}

export default VideoRoom;