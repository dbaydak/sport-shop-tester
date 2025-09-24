import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",  # <-- Указываем полный путь к объекту app
        host="127.0.0.1",
        port=8000,
        reload=True,
        # Указываем, где искать файлы для перезагрузки
        reload_dirs=["backend"],
    )
