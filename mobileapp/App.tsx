import { useState } from "react";

import TelaLogin from "./src/views/TelaLogin";
import TelaCadastro from "./src/views/TelaCadastro";

export default function App() {
  const [tela, setTela] = useState<"login" | "cadastro">("login");

  if (tela === "cadastro") {
    return (
      <TelaCadastro
        onGoToLogin={() => setTela("login")}
      />
    );
  }

  return <TelaLogin onGoToCadastro={() => setTela("cadastro")} />;
}