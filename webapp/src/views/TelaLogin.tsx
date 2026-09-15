// src/views/TelaLogin.tsx
// Tela de login do aplicativo web
// =============================================================================

import { useState, type FormEvent } from "react";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import Logo from "../components/Logo";
import "../App.css";

type Feedback = {
  type: "" | "error" | "success";
  message: string;
};

function getAuthErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : "";
  }

  return "";
}

export default function TelaLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ type: "", message: "" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback({ type: "", message: "" });
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setFeedback({ type: "success", message: "Login realizado com sucesso." });
    } catch (error: unknown) {
      const messages: Record<string, string> = {
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/invalid-email": "Digite um e-mail valido.",
        "auth/too-many-requests":
          "Muitas tentativas. Aguarde e tente novamente.",
      };

      setFeedback({
        type: "error",
        message:
          messages[getAuthErrorCode(error)] ||
          "Nao foi possivel entrar. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordReset() {
    if (!email) {
      setFeedback({
        type: "error",
        message: "Informe seu e-mail para recuperar a senha.",
      });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setFeedback({
        type: "success",
        message: "Enviamos um link para redefinir sua senha.",
      });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        message:
          getAuthErrorCode(error) === "auth/invalid-email"
            ? "Digite um e-mail valido."
            : "Nao foi possivel enviar o link de recuperacao.",
      });
    }
  }

  return (
    <main className="login-page">
      <div className="login-layout">
        <div>
          <section
            className="login-logo" aria-label="FinUp" >
            <Logo />
          </section>
        </div>
        <section className="login-showcase" aria-label="FinUp">
          <div className="showcase-copy">
            <p className="eyebrow">Sua vida financeira, com clareza</p>
            <h1>
              Planeje hoje.
              <br />
              <span>Conquiste amanhã.</span>
            </h1>
            <p className="showcase-description">
              Organize suas contas, acompanhe seus objetivos e tome decisões
              melhores com o seu dinheiro.
            </p>
          </div>
          <div className="showcase-insight" aria-hidden="true">
            <span className="insight-label">visão do seu mês</span>
            <strong>Sonho evoluindo</strong>
            <span className="insight-caption">saldo planejado</span>
            <div className="insight-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <form className="login-card" onSubmit={handleSubmit}>
            <div className="form-heading">
              <p className="eyebrow">Acesse sua conta</p>
              <h2 id="login-title">Bem-vindo de volta</h2>
              <p className="welcome">
                Entre para continuar sua jornada financeira.
              </p>
            </div>

            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              required
            />

            <label htmlFor="password">Senha</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
                required
              />
              <button
                className="visibility-button"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? "ocultar" : "mostrar"}
              </button>
            </div>

            <button
              className="forgot-button"
              type="button"
              onClick={handlePasswordReset}
            >
              Esqueci minha senha
            </button>

            {feedback.message && (
              <p className={`feedback ${feedback.type}`} role="status">
                {feedback.message}
              </p>
            )}

            <button
              className="submit-button"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="register-area">
            <span>Não tem uma conta?</span>
            <button type="button" onClick={() => navigate("/cadastro")}>
              Criar conta gratis
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
