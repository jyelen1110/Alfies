import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { OrderProvider } from './src/context/OrderContext';
import Navigation from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OrderProvider>
          <Navigation />
          <StatusBar style="light" />
        </OrderProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
