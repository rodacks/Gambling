import { Provider } from "@/components/provider";
import { App } from "@/components/app";
import { AccountProvider } from "@/components/v2/account";
export default function Page() {
  return (
    <AccountProvider>
      <Provider>
        <App />
      </Provider>
    </AccountProvider>
  );
}
