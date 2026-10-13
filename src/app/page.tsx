import { Provider } from "@/components/provider";
import { App } from "@/components/app";
export default function Page() {
  return (
    <Provider>
      <App />
    </Provider>
  );
}
