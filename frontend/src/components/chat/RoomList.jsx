import { useState } from 'react';

export default function RoomList({ rooms, selectedRoomId, onSelect, onCreate }) {
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
    setShowInput(false);
  }

  return (
    <div className="flex flex-col h-full border-r border-gray-200 w-64">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="font-semibold text-gray-800">Rooms</span>
        <button
          onClick={() => setShowInput((v) => !v)}
          className="text-blue-600 hover:text-blue-700 text-lg font-bold"
          title="Tạo room mới"
        >
          +
        </button>
      </div>

      {showInput && (
        <form onSubmit={handleSubmit} className="px-4 py-2 border-b border-gray-100">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên room..."
            className="w-full border rounded px-2 py-1 text-sm"
            autoFocus
          />
          <button type="submit" className="mt-1 w-full bg-blue-600 text-white rounded px-2 py-1 text-sm">
            Tạo
          </button>
        </form>
      )}

      <ul className="flex-1 overflow-y-auto">
        {rooms.map((room) => (
          <li
            key={room.id}
            onClick={() => onSelect(room.id)}
            className={`px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
              room.id === selectedRoomId ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
            }`}
          >
            <p className="font-medium text-sm text-gray-800">{room.name}</p>
            {room.lastMessage && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{room.lastMessage.content}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
