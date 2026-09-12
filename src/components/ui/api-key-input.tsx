import * as React from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function ApiKeyInput({ value, onChange, className, ...props }: ApiKeyInputProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy API key:", error);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        type={isVisible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("flex-1", className)}
        {...props}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setIsVisible(!isVisible)}
        className="shrink-0 h-11 w-11"
        title={isVisible ? "Hide API key" : "Show API key"}
      >
        {isVisible ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleCopy}
        disabled={!value}
        className="shrink-0 h-11 w-11"
        title="Copy API key"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}