import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { RootStackParamList } from "./src/navigation/types";

import TelaLogin from "./src/views/TelaLogin";
import TelaCadastro from "./src/views/TelaCadastro";
import TelaInicial from "./src/views/TelaInicial";
import TelaCadastroReceitas from "./src/views/TelaCadastroReceitas"

{/* Criando a pilha de navegação */ }
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

        <Stack.Screen
          name="Inicio"
          component={TelaInicial}
        />

        <Stack.Screen
          name="CadastroReceitas"
          component={TelaCadastroReceitas}
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
}