import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

{/* Importando o tipo de navegação */ }
import { RootStackParamList } from "./src/navigation/types";

{/* Importando as telas */ }
import TelaLogin from "./src/views/TelaLogin";
import TelaCadastro from "./src/views/TelaCadastro";
import TelaInicial from "./src/views/TelaInicial";
import TelaCadastroReceitas from "./src/views/TelaCadastroRegistros"
import TelaAssistente from "./src/views/TelaAssistente";

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
          name="CadastroRegistros"
          component={TelaCadastroReceitas}
        />

        <Stack.Screen
          name="Assistente"
          component={TelaAssistente}
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
}