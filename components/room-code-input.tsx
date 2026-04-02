'use client';

import { Input } from "@/components/ui/input";
import { Hash } from "lucide-react";

interface RoomCodeInputProps {
  id: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export default function RoomCodeInput({
  id,
  name,
  required,
  placeholder = "请输入6位房间码",
  maxLength = 6
}: RoomCodeInputProps) {
  return (
    <div className="glass rounded-xl p-3 flex items-center space-x-2">
      <Hash className="w-5 h-5 text-gray-400" />
      <Input
        id={id}
        name={name}
        type="text"
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        onChange={(e) => {
          e.target.value = e.target.value.toUpperCase();
        }}
        className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}