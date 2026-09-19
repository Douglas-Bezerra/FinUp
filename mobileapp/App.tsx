import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { RootStackParamList } from "./src/navigation/types";

import TelaLogin from "./src/views/TelaLogin";
import TelaCadastro from "./src/views/TelaCadastro";
import TelaInicial from "./src/views/TelaInicial";

{/* Criando a pilha de navegação */ }
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer> {/*NavigationContainer é o componente que gerencia a navegação do aplicativo. Ele deve envolver toda a estrutura de navegação. */}
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="Login"
          component={TelaLogin}
        />

        <Stack.Screen
          name="Cadastro"
          component={TelaCadastro}
        />

        <Stack.Screen
          name="Inicio"
          component={TelaInicial}
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
}