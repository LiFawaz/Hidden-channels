import { use } from "@valenced/json-storage";
import { FormSwitch, Page } from "@valenced/components";
import { storage } from "valenced";

export function Settings() {
  const state = use(storage); // re-renders when storage updates

  return (
    <Page>
      <FormSwitch
        label="Show lock icon"
        value={state.showIcon ?? true}
        onValueChange={(v: boolean) => (storage.showIcon = v)}
      />
      <FormSwitch
        label="Show confirmation popup"
        value={state.showPopup ?? true}
        onValueChange={(v: boolean) => (storage.showPopup = v)}
      />
    </Page>
  );
}
