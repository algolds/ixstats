import { useState } from "react";
import { User, Edit3, Save, X } from "lucide-react";
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

interface ThinkPagesSettingsCardProps {
  thinkpagesAccount: any;
  updateThinkpagesAccountMutation: any;
  onRefetch: () => void;
}

export function ThinkPagesSettingsCard({
  thinkpagesAccount,
  updateThinkpagesAccountMutation,
  onRefetch
}: ThinkPagesSettingsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [postingFrequency, setPostingFrequency] = useState((thinkpagesAccount as any).postingFrequency || '');
  const [politicalLean, setPoliticalLean] = useState((thinkpagesAccount as any).politicalLean || '');
  const [personality, setPersonality] = useState((thinkpagesAccount as any).personality || '');

  const handleSave = async () => {
    try {
      await updateThinkpagesAccountMutation.mutateAsync({
        accountId: thinkpagesAccount.id,
        postingFrequency: postingFrequency as 'active' | 'moderate' | 'low',
        politicalLean: politicalLean as 'left' | 'center' | 'right',
        personality: personality as 'serious' | 'casual' | 'satirical',
      });
      toast.success('Thinkpages settings updated!');
      setIsEditing(false);
      onRefetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update Thinkpages settings');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setPostingFrequency((thinkpagesAccount as any).postingFrequency);
    setPoliticalLean((thinkpagesAccount as any).politicalLean);
    setPersonality((thinkpagesAccount as any).personality);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Thinkpages Account Settings
          </h2>
        </div>
        <div>
          {isEditing ? (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={updateThinkpagesAccountMutation.isPending}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-md text-sm disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 text-white rounded-md text-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Posting Frequency
          </label>
          {isEditing ? (
            <Select value={postingFrequency} onValueChange={setPostingFrequency}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-gray-900 dark:text-white capitalize">{postingFrequency}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Political Lean
          </label>
          {isEditing ? (
            <Select value={politicalLean} onValueChange={setPoliticalLean}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select lean" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-gray-900 dark:text-white capitalize">{politicalLean}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Personality
          </label>
          {isEditing ? (
            <Select value={personality} onValueChange={setPersonality}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select personality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="serious">Serious</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="satirical">Satirical</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-gray-900 dark:text-white capitalize">{personality}</p>
          )}
        </div>
      </div>
    </div>
  );
}
