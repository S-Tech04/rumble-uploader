import { useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

const Toast = ({ message, type, onClose, duration = 4000 }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-white" />,
    error: <XCircle className="w-5 h-5 text-white" />,
    info: <AlertCircle className="w-5 h-5 text-white" />,
  };

  const styles = {
    success: "bg-success/90 border-success text-white",
    error: "bg-destructive/90 border-destructive text-white",
    info: "bg-primary/90 border-primary text-white",
  };

  return (
    <div
      className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg border-2 ${styles[type]} shadow-lg animate-slide-in min-w-[300px]`}
      style={{
        animation: "slideIn 0.3s ease-out",
      }}
    >
      {icons[type]}
      <p className="text-sm font-medium pr-8">{message}</p>
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;
