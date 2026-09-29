import { useState } from "react";
import { supabase } from "../supabase";

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Login successful!");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage(
          "Account created! Please check your email to confirm your account."
        );
      }
    }

    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#1e293b",
          padding: "35px",
          borderRadius: "16px",
        }}
      >
        <h1 style={{ textAlign: "center", marginBottom: "10px" }}>
          Video Call Platform
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#94a3b8",
            marginBottom: "30px",
          }}
        >
          {isLogin ? "Login to continue" : "Create your account"}
        </p>

        {!isLogin && (
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            style={inputStyle}
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={loading}
          style={buttonStyle}
        >
          {loading
            ? "Please wait..."
            : isLogin
            ? "Login"
            : "Create Account"}
        </button>

        {message && (
          <p
            style={{
              marginTop: "20px",
              textAlign: "center",
              color: "#38bdf8",
            }}
          >
            {message}
          </p>
        )}

        <p
          style={{
            textAlign: "center",
            marginTop: "25px",
            color: "#94a3b8",
          }}
        >
          {isLogin
            ? "Don't have an account?"
            : "Already have an account?"}

          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#38bdf8",
              cursor: "pointer",
              marginLeft: "6px",
            }}
          >
            {isLogin ? "Sign up" : "Login"}
          </button>
        </p>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px",
  marginBottom: "15px",
  borderRadius: "8px",
  border: "1px solid #475569",
  background: "#0f172a",
  color: "white",
  fontSize: "15px",
};

const buttonStyle = {
  width: "100%",
  padding: "13px",
  borderRadius: "8px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontSize: "16px",
  cursor: "pointer",
};

export default Auth;