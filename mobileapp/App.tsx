// App.tsx
// Arquivo principal do projeto
// Para executar o projeto, execute "expo start" no terminal ou npx expo start
// =============================================================================

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { RootStackParamList } from "./src/navigation/types";

import TelaLogin from "./src/views/TelaLogin";
import TelaCadastro from "./src/views/TelaCadastro";


const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}