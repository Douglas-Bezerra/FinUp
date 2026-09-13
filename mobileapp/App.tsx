import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Login from "./src/views/Login";
import Cadastro from "./src/views/Cadastro";

const Stack = createNativeStackNavigator();

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
          component={Login}
        />

        <Stack.Screen
          name="Cadastro"
          component={Cadastro}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}