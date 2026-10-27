export default function StatusBar({ warning, realtimeOk }: { warning: string | null; realtimeOk: boolean }) {
  if (warning) {
    return (
      <div className="statusbar bad" role="alert">
        {warning} — đang thử kết nối lại…
      </div>
    );
  }
  if (!realtimeOk) {
    return <div className="statusbar warn">Đang kết nối cập nhật trực tiếp… (dữ liệu vẫn được làm mới định kỳ)</div>;
  }
  return null;
}
