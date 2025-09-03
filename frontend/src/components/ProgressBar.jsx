export default function ProgressBar({ value = 0 }) {
  return (
    <div className="w-full">
      <div className="w-full h-2 bg-gray-200 rounded">
        <div className="h-2 bg-green-500 rounded" style={{ width: `${value}%` }} />
      </div>
      <div className="text-xs text-gray-600 mt-1">{value}%</div>
    </div>
  );
}
