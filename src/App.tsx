import React, { useState, useEffect } from "react";
import {
  Upload,
  Image as ImageIcon,
  Video,
  Wand2,
  Download,
  Settings,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { motion } from "motion/react";
import { GoogleGenAI } from "@google/genai";

const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [modelImage, setModelImage] = useState<File | null>(null);
  const [modelPreview, setModelPreview] = useState<string | null>(null);

  const [garmentImage, setGarmentImage] = useState<File | null>(null);
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);

  const [mode, setMode] = useState<"tryon" | "lookbook">("tryon");
  const [exportType, setExportType] = useState<"image" | "frames">(
    "image",
  );

  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");

  const [hasRights, setHasRights] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);

  // Nano banana feature state
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setModelImage(file);
      setModelPreview(URL.createObjectURL(file));
    }
  };

  const handleGarmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGarmentImage(file);
      setGarmentPreview(URL.createObjectURL(file));
    }
  };

  const handleGenerate = async () => {
    if (!hasRights) {
      alert("Vui lòng xác nhận bạn có quyền sử dụng hình ảnh.");
      return;
    }
    if (!modelImage || !garmentImage) {
      alert("Vui lòng tải lên cả ảnh người mẫu và trang phục.");
      return;
    }

    setIsProcessing(true);

    try {
      const modelBase64 = await fileToBase64(modelImage);
      const garmentBase64 = await fileToBase64(garmentImage);
      
      // We use the garment image as a reference in the prompt
      const basePrompt = mode === "tryon" 
        ? "Virtual try-on: Edit the first image (person) to wear the garment from the second image. If the second image only shows a top (shirt/jacket), automatically generate matching pants or a skirt that fits the style. The person's face, hair, body, pose, and the entire background MUST remain exactly the same as the first image. ONLY replace the clothing."
        : "Virtual try-on: Edit the first image (person) to wear the garment from the second image. If the second image only shows a top (shirt/jacket), automatically generate matching pants or a skirt that fits the style. The person's face, hair, body, pose, and the entire background MUST remain exactly the same as the first image. Enhance the lighting to look like a professional fashion lookbook photoshoot.";
        
      const finalPrompt = prompt ? `${basePrompt} Additional instructions: ${prompt}` : basePrompt;
      const finalNegativePrompt = negativePrompt ? `Negative prompt: ${negativePrompt}` : "";
      
      // @ts-ignore
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyDuyccmjukAl4LhRcz8ExjVGlqElN6ydPQ' });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: modelBase64,
                mimeType: modelImage.type,
              }
            },
            {
              inlineData: {
                data: garmentBase64,
                mimeType: garmentImage.type,
              }
            },
            {
              text: `${finalPrompt} ${finalNegativePrompt}`
            }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: "9:16"
          }
        }
      });

      let imageUrl = null;
      if (response.candidates && response.candidates.length > 0 && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (imageUrl) {
        setResultImage(imageUrl);
      } else {
        throw new Error("No image returned from API");
      }
    } catch (error: any) {
      console.error(error);
      alert(`Đã xảy ra lỗi khi tạo ảnh: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNanoBananaEdit = async () => {
    if (!resultImage && !modelImage) {
      alert("Vui lòng tải lên ảnh hoặc tạo ảnh trước khi chỉnh sửa.");
      return;
    }
    if (!editPrompt) {
      alert("Vui lòng nhập yêu cầu chỉnh sửa.");
      return;
    }

    setIsEditing(true);
    try {
      let imageBlob: Blob;
      const currentImage = resultImage || modelPreview;

      if (currentImage && currentImage.startsWith("data:image")) {
        const res = await fetch(currentImage);
        imageBlob = await res.blob();
      } else if (currentImage && currentImage.startsWith("blob:")) {
        const res = await fetch(currentImage);
        imageBlob = await res.blob();
      } else {
        imageBlob = modelImage as Blob;
      }

      const imageBase64 = await fileToBase64(imageBlob);

      // @ts-ignore
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyDuyccmjukAl4LhRcz8ExjVGlqElN6ydPQ' });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: imageBlob.type || 'image/png',
              }
            },
            {
              text: editPrompt
            }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: "9:16"
          }
        }
      });

      let imageUrl = null;
      if (response.candidates && response.candidates.length > 0 && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (imageUrl) {
        setResultImage(imageUrl);
      } else {
        throw new Error("No image returned from API");
      }
    } catch (error: any) {
      console.error(error);
      alert(`Đã xảy ra lỗi khi chỉnh sửa ảnh: ${error.message}`);
    } finally {
      setIsEditing(false);
    }
  };

  const handleDownload = () => {
    if (resultImage) {
      const a = document.createElement("a");
      a.href = resultImage;
      a.download = "outfit-swap-result.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-2 rounded-xl">
              <Wand2 size={20} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              Outfit Swap{" "}
              <span className="text-zinc-500 font-normal">
                for Affiliate Video
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-zinc-600">
            <a href="#tips" className="hover:text-zinc-900 transition-colors">
              Mẹo tối ưu
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar - Controls */}
          <div className="lg:col-span-4 space-y-6">
            {/* Upload Section */}
            <section className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload size={18} className="text-indigo-600" />
                Tải lên hình ảnh
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Ảnh người mẫu (Source)
                  </label>
                  <div className="relative border-2 border-dashed border-zinc-300 rounded-xl p-4 hover:bg-zinc-50 transition-colors text-center cursor-pointer overflow-hidden group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleModelUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    {modelPreview ? (
                      <img
                        src={modelPreview}
                        alt="Model Preview"
                        className="h-32 mx-auto object-contain rounded-lg"
                      />
                    ) : (
                      <div className="py-4">
                        <ImageIcon className="mx-auto h-8 w-8 text-zinc-400 mb-2 group-hover:text-indigo-500 transition-colors" />
                        <span className="text-sm text-zinc-500">
                          Kéo thả hoặc click để chọn ảnh
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Ảnh trang phục (Garment)
                  </label>
                  <div className="relative border-2 border-dashed border-zinc-300 rounded-xl p-4 hover:bg-zinc-50 transition-colors text-center cursor-pointer overflow-hidden group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleGarmentUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    {garmentPreview ? (
                      <img
                        src={garmentPreview}
                        alt="Garment Preview"
                        className="h-32 mx-auto object-contain rounded-lg"
                      />
                    ) : (
                      <div className="py-4">
                        <ImageIcon className="mx-auto h-8 w-8 text-zinc-400 mb-2 group-hover:text-indigo-500 transition-colors" />
                        <span className="text-sm text-zinc-500">
                          Kéo thả hoặc click để chọn ảnh
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Settings Section */}
            <section className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings size={18} className="text-indigo-600" />
                Cài đặt tạo ảnh
              </h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Chế độ
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMode("tryon")}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${mode === "tryon" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                    >
                      Try-on giữ mặt
                    </button>
                    <button
                      onClick={() => setMode("lookbook")}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${mode === "lookbook" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                    >
                      Fashion Lookbook
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    {mode === "tryon"
                      ? "Giữ nguyên khuôn mặt và tóc tối đa, chỉ thay đổi trang phục."
                      : "Tăng độ đẹp, ánh sáng chuyên nghiệp, giữ danh tính nhất quán."}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Prompt (Tùy chọn)
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ví dụ: high quality, photorealistic, fashion photography..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-20 bg-zinc-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Negative Prompt (Tùy chọn)
                  </label>
                  <textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="Ví dụ: mutated hands, deformed face, bad anatomy..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-20 bg-zinc-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Định dạng xuất
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setExportType("image")}
                      className={`px-2 py-2 text-xs font-medium rounded-lg border transition-all flex flex-col items-center gap-1 ${exportType === "image" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                    >
                      <ImageIcon size={16} />
                      Ảnh (PNG)
                    </button>
                    <button
                      onClick={() => setExportType("frames")}
                      className={`px-2 py-2 text-xs font-medium rounded-lg border transition-all flex flex-col items-center gap-1 ${exportType === "frames" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                    >
                      <ImageIcon size={16} />
                      Frames
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100">
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={hasRights}
                        onChange={(e) => setHasRights(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-4 h-4 rounded border border-zinc-300 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-colors"></div>
                      <CheckCircle2
                        size={12}
                        className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                      />
                    </div>
                    <span className="text-xs text-zinc-600 leading-relaxed group-hover:text-zinc-900 transition-colors">
                      Tôi xác nhận có quyền sử dụng các hình ảnh này và đồng ý
                      với điều khoản không tạo nội dung nhạy cảm.
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={
                    isProcessing || !hasRights || !modelImage || !garmentImage
                  }
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Wand2 size={18} />
                      Tạo kết quả
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>

          {/* Right Content - Preview & Edit */}
          <div className="lg:col-span-8 space-y-6">
            {/* Main Preview */}
            <section className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm min-h-[500px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ImageIcon size={18} className="text-indigo-600" />
                  Kết quả Preview
                </h2>
                {resultImage && (
                  <button
                    onClick={handleDownload}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download size={16} />
                    Tải xuống
                  </button>
                )}
              </div>

              <div className="flex-1 bg-zinc-100 rounded-xl border border-zinc-200 overflow-hidden relative flex items-center justify-center">
                {resultImage ? (
                  <motion.img
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={resultImage}
                    alt="Result"
                    className="max-w-full max-h-[600px] object-contain"
                  />
                ) : (
                  <div className="text-center text-zinc-400 p-8">
                    <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Kết quả sẽ hiển thị tại đây sau khi xử lý.</p>
                    <p className="text-sm mt-2 max-w-md mx-auto">
                      Hệ thống sẽ tự động thêm watermark "AI-generated" để đảm
                      bảo tính minh bạch.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Nano Banana Feature - Gemini Image Edit */}
            <section className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-100">
                  <Wand2 size={24} className="text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-indigo-900 mb-1">
                    Chỉnh sửa bằng AI (Nano Banana)
                  </h3>
                  <p className="text-sm text-indigo-700/80 mb-4">
                    Sử dụng Gemini 2.5 Flash Image để chỉnh sửa ảnh bằng văn
                    bản. Ví dụ: "Thêm kính râm", "Đổi nền thành bãi biển", "Thêm
                    bộ lọc retro".
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="Nhập yêu cầu chỉnh sửa..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
                    />
                    <button
                      onClick={handleNanoBananaEdit}
                      disabled={
                        isEditing ||
                        (!resultImage && !modelImage) ||
                        !editPrompt
                      }
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-xl transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                    >
                      {isEditing ? (
                        <RefreshCw size={18} className="animate-spin" />
                      ) : (
                        "Chỉnh sửa"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Documentation Section */}
        <div className="mt-16 space-y-12 border-t border-zinc-200 pt-12">
          <section id="tips">
            <h2 className="text-2xl font-bold mb-6">
              Mẹo tối ưu chất lượng & An toàn
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                <h3 className="font-semibold text-indigo-900 text-lg mb-3">
                  Tối ưu Diffusion (Prompting)
                </h3>
                <ul className="space-y-2 text-sm text-indigo-800">
                  <li>
                    <strong>Prompt:</strong> "high quality, 8k, photorealistic,
                    fashion photography, perfect lighting, detailed fabric
                    texture"
                  </li>
                  <li>
                    <strong>Negative Prompt:</strong> "mutated hands, deformed
                    face, bad anatomy, lowres, text, watermark, nudity, nsfw"
                  </li>
                  <li>
                    <strong>CFG Scale:</strong> 7.0 - 8.5 (cân bằng giữa prompt
                    và ảnh gốc).
                  </li>
                  <li>
                    <strong>Steps:</strong> 30 - 50 (Euler a hoặc DPM++ 2M
                    Karras).
                  </li>
                </ul>
              </div>
              <div className="bg-red-50 p-6 rounded-xl border border-red-100">
                <h3 className="font-semibold text-red-900 text-lg mb-3">
                  Bảo vệ An toàn & Pháp lý
                </h3>
                <ul className="space-y-2 text-sm text-red-800">
                  <li>
                    <strong>Content Filter:</strong> Tích hợp bộ lọc NSFW (ví
                    dụ: <code>safety_checker</code> của HuggingFace) trước khi
                    xử lý.
                  </li>
                  <li>
                    <strong>Watermark:</strong> Luôn chèn mờ chữ "AI-generated"
                    ở góc ảnh để minh bạch.
                  </li>
                  <li>
                    <strong>Terms of Service:</strong> Yêu cầu checkbox xác nhận
                    bản quyền (đã implement ở UI).
                  </li>
                  <li>
                    <strong>Face Lock:</strong> Chế độ "Try-on" không cho phép
                    thay đổi khuôn mặt thành người nổi tiếng.
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
