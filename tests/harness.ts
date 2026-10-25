import { checkRepository, checkRepositoryFailures, createRepositoryTest, checkBlockedOpen } from './helpers/repository-browser';
import { createEditorTest, checkEditSaveRoundTrips } from './helpers/editor-browser';
declare global { interface Window { checkRepository: typeof checkRepository; checkRepositoryFailures: typeof checkRepositoryFailures; checkBlockedOpen: typeof checkBlockedOpen; createRepositoryTest: typeof createRepositoryTest; createEditorTest: typeof createEditorTest; checkEditSaveRoundTrips: typeof checkEditSaveRoundTrips; activeEditor: ReturnType<typeof createEditorTest> } }
window.checkRepository = checkRepository;
window.checkRepositoryFailures = checkRepositoryFailures;
window.createEditorTest = createEditorTest;
window.createRepositoryTest = createRepositoryTest;
window.checkEditSaveRoundTrips = checkEditSaveRoundTrips;
window.checkBlockedOpen = checkBlockedOpen;
