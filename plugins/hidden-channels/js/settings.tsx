import { useProxy } from "@valenced/json-storage";
import { FormSection, FormSwitchRow } from "@valenced/discord/design";
import { storage } from "valenced";

export function Settings() {
  useProxy(storage);

  return (
    <FormSection title="Hidden Channels">
      <FormSwitchRow
        label="Show lock icon"
        value={storage.showIcon ?? true}
        onValueChange={(v: boolean) => (storage.showIcon = v)}
      />
      <FormSwitchRow
        label="Show confirmation popup"
        value={storage.showPopup ?? true}
        onValueChange={(v: boolean) => (storage.showPopup = v)}
      />
    </FormSection>
  );
}
