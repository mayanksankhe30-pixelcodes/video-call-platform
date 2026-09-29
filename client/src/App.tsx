import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Auth from "./pages/Auth";
import VideoRoom from "./pages/VideoRoom";

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const [meetingCode, setMeetingCode] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [joiningMeeting, setJoiningMeeting] = useState(false);
  const [joinedMeeting, setJoinedMeeting] = useState<any>(null);
  const [inVideoRoom, setInVideoRoom] = useState(false);

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Listen for login/logout changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --------------------------------
  // CREATE MEETING
  // --------------------------------
  const createMeeting = async () => {
    if (!session?.user?.id) {
      alert("You must be logged in.");
      return;
    }

    setCreatingMeeting(true);

    try {
      const roomCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      const { data, error } = await supabase
        .from("meetings")
        .insert([
          {
            room_code: roomCode,
            host_id: session.user.id,
            title: "Video Meeting",
            is_locked: false,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Create meeting error:", error);

        alert(
          "Failed to create meeting:\n" +
            error.message
        );

        return;
      }

      console.log("Meeting created:", data);

      setMeetingCode(data.room_code);

      alert(
        `Meeting created successfully!\nMeeting ID: ${data.room_code}`
      );
    } catch (error) {
      console.error("Unexpected error:", error);

      alert(
        "Something went wrong while creating the meeting."
      );
    } finally {
      setCreatingMeeting(false);
    }
  };

  // --------------------------------
  // JOIN MEETING
  // --------------------------------
  const joinMeeting = async () => {
    if (!session?.user?.id) {
      alert("You must be logged in.");
      return;
    }

    const code = joinCode.trim().toUpperCase();

    if (!code) {
      alert("Please enter a meeting ID.");
      return;
    }

    setJoiningMeeting(true);

    try {
      // Find the meeting
      const { data: meeting, error: meetingError } =
        await supabase
          .from("meetings")
          .select("*")
          .eq("room_code", code)
          .maybeSingle();

      if (meetingError) {
        console.error(
          "Join meeting error:",
          meetingError
        );

        alert(
          "Could not check the meeting:\n" +
            meetingError.message
        );

        return;
      }

      if (!meeting) {
        alert(
          "Meeting not found. Please check the Meeting ID."
        );

        return;
      }

      if (meeting.is_locked) {
        alert("This meeting is locked.");
        return;
      }

      // Add the current user as a participant
      const { error: participantError } =
        await supabase
          .from("participants")
          .insert([
            {
              meeting_id: meeting.id,
              user_id: session.user.id,
              display_name:
                session.user.user_metadata?.full_name ||
                session.user.email ||
                "User",
              is_host:
                meeting.host_id === session.user.id,
              is_cohost: false,
              mic_enabled: true,
              camera_enabled: true,
              hand_raised: false,
            },
          ]);

      if (participantError) {
        console.error(
          "Participant insert error:",
          participantError
        );

        alert(
          "Could not join the meeting:\n" +
            participantError.message
        );

        return;
      }

      console.log("Meeting joined:", meeting);

      setJoinedMeeting(meeting);

      alert(
        `Meeting joined successfully!\nMeeting ID: ${meeting.room_code}`
      );
    } catch (error) {
      console.error(
        "Unexpected join error:",
        error
      );

      alert(
        "Something went wrong while joining the meeting."
      );
    } finally {
      setJoiningMeeting(false);
    }
  };

  // --------------------------------
  // LOADING
  // --------------------------------
  if (loading) {
    return (
      <div className="loading">
        Loading...
      </div>
    );
  }

  // --------------------------------
  // NOT LOGGED IN
  // --------------------------------
  if (!session) {
    return <Auth />;
  }
// --------------------------------
// VIDEO ROOM
// --------------------------------
if (inVideoRoom && joinedMeeting) {
  return (
    <VideoRoom
      meetingId={joinedMeeting.room_code}
      onLeave={() => {
        setInVideoRoom(false);
        setJoinedMeeting(null);
      }}
    />
  );
}
  // --------------------------------
  // DASHBOARD
  // --------------------------------
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Video Call Platform</h1>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
          }}
        >
          Logout
        </button>
      </header>

      <main className="dashboard-content">
        <h2>Welcome 👋</h2>

        <p>
          Logged in as:
          <strong> {session.user.email}</strong>
        </p>

        {/* CREATE MEETING */}
        <div className="dashboard-card">
          <h3>Meetings</h3>

          <p>
            Your meetings will appear here.
          </p>

          <button
            onClick={createMeeting}
            disabled={creatingMeeting}
          >
            {creatingMeeting
              ? "Creating..."
              : "+ Create Meeting"}
          </button>

          {meetingCode && (
            <div>
              <p>
                <strong>Meeting ID:</strong>{" "}
                {meetingCode}
              </p>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    meetingCode
                  );

                  alert("Meeting ID copied!");
                }}
              >
                Copy Meeting ID
              </button>
            </div>
          )}
        </div>

        {/* JOIN MEETING */}
        <div className="dashboard-card">
          <h3>Join a Meeting</h3>

          <p>
            Enter a meeting ID to join a call.
          </p>

          <input
            type="text"
            placeholder="Enter meeting ID"
            value={joinCode}
            onChange={(e) =>
              setJoinCode(
                e.target.value.toUpperCase()
              )
            }
          />

          <button
            onClick={joinMeeting}
            disabled={joiningMeeting}
          >
            {joiningMeeting
              ? "Joining..."
              : "Join Meeting"}
          </button>

          {joinedMeeting && (
            <div>
              <p>
                <strong>Meeting Found:</strong>{" "}
                {joinedMeeting.room_code}
              </p>

              <p>
                <strong>Title:</strong>{" "}
                {joinedMeeting.title}
              </p>

             <button
  onClick={() => {
    setInVideoRoom(true);
  }}
>
  Enter Video Call
</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;