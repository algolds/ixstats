export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (wikitext: string) => void;
}
