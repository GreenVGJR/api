import { createWorker, PSM } from "tesseract.js";
import { join } from "path";

let workerPromise: ReturnType<typeof createWorker> | null = null;

function getWorkerPath() {
	return join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js");
}

export async function getOCRWorker() {
	if (!workerPromise) {
		workerPromise = createWorker("eng", undefined, {
			logger: () => {},
			workerPath: getWorkerPath(),
		});
		const worker = await workerPromise;
		await worker.setParameters({
			tessedit_pageseg_mode: PSM.AUTO,
			user_defined_dpi: "300",
		});
	}
	return workerPromise;
}
