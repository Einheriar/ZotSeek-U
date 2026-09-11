# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## Cloud embedding and Local Server naming

zotseek-pref-localServerReady = Local Server ({ $model })
zotseek-pref-localServerState = Local Server ({ $state })
zotseek-pref-cloudSlotReady = Cloud ({ $model })
zotseek-pref-cloudSlotSetup = Cloud (SETUP REQUIRED)
zotseek-pref-cloudTitle = Cloud Model
zotseek-pref-cloudDesc = กำหนดค่าบริการ Cloud Embedding แบบ BYOK เนื้อหาที่จัดทำดัชนีและคำค้นหาเชิงความหมายจะถูกส่งไปยังผู้ให้บริการคลาวด์ โดย ZotSeek-U ไม่เรียกเก็บค่าบริการหรือรับส่วนแบ่งค่าบริการ การจัดทำดัชนีและการค้นหาต้องเชื่อมต่ออินเทอร์เน็ตและใช้โควตา API ของผู้ให้บริการ ซึ่งอาจมีค่าใช้จ่าย โปรดดูรายละเอียดจากเอกสารอัตราค่าบริการของผู้ให้บริการคลาวด์
zotseek-pref-cloudProvider = Provider
zotseek-pref-cloudBaseUrl = Base URL
zotseek-pref-cloudModel = Model
zotseek-pref-cloudDimensions = Dimensions
zotseek-pref-cloudAdvanced = Advanced model parameters
zotseek-pref-cloudMaxInputTokens = Maximum input Tokens
zotseek-pref-cloudRecommendedChunkTokens = Recommended Chunk Tokens
zotseek-pref-cloudQueryParameter = Advanced query parameter (optional)
zotseek-pref-cloudIndexParameter = Advanced indexing parameter (optional)
zotseek-pref-cloudBatchSize = Maximum inputs per batch
zotseek-pref-cloudResetSettings = Restore default settings
zotseek-pref-cloudApiKey = API Key
zotseek-pref-cloudApiKeyMissing = Not configured
zotseek-pref-cloudSetApiKey =
    .label = Set / replace
zotseek-pref-cloudRemoveApiKey =
    .label = Remove
zotseek-pref-cloudTest =
    .label = Test connection
zotseek-pref-cloudAutoIndex =
    .label = อนุญาตให้ Zotero ดูแลดัชนีอัตโนมัติเมื่อเริ่มต้นขณะใช้โมเดล Cloud
zotseek-pref-cloudAutoIndexDesc = Off by default. The global Automatic Maintenance setting must also be enabled.
zotseek-pref-cloudConnectionVerified = Connection verified.
zotseek-pref-cloudConnectionNotVerified = Connection not verified. Set an API key and test the connection before selecting Cloud.
zotseek-pref-cloudTesting = Testing with a fixed probe text… This call may incur a very small provider charge.
zotseek-pref-cloudTestFailed = Connection test failed: { $error }
zotseek-pref-cloudInvalidConfig = Invalid Cloud configuration: { $error }
zotseek-pref-cloudSecureStorageError = Secure credential storage failed: { $error }
zotseek-pref-cloudApiKeyPromptTitle = Set Cloud API Key
zotseek-pref-cloudApiKeyPromptMessage = Paste your { $provider } API Key. It will be encrypted using Zotero secure credential storage and will not be written to preferences, configuration files, or logs.
zotseek-pref-cloudRemoveApiKeyTitle = Remove Cloud API Key
zotseek-pref-cloudRemoveApiKeyMessage = Remove the saved Cloud API Key? If Cloud is active, ZotSeek will switch back to the built-in E5 model.
zotseek-pref-cloudConsentTitle = Send embedding content to a Cloud provider?
zotseek-pref-cloudConsentMessage = When Cloud is selected, ZotSeek sends content included by the current indexing mode and every semantic or Hybrid query to { $provider }. You must provide your own API Key (BYOK). The provider may charge your account; all fees are paid only to the provider. ZotSeek does not charge, receive a share, or participate in billing. A connection test sends fixed probe text and may also incur a very small provider charge. Continue?
zotseek-pref-cloudConsentCustomMessage = You selected a custom OpenAI-compatible provider. ZotSeek will send your API Key, the content included by the current indexing mode, and every semantic or Hybrid query to the endpoint you configured. ZotSeek cannot verify how that service stores or uses your data. You are responsible for the endpoint, model, and dimensions you configured. Continue?
zotseek-pref-cloudRegion = Bailian Region
zotseek-pref-cloudRegionCn = Mainland China
zotseek-pref-cloudRegionIntl = International
zotseek-pref-cloudCustomWarning = You are responsible for the endpoint, model, and dimensions you configure here. ZotSeek sends your API Key and indexed content to this address.
zotseek-pref-cloudUnconfigured = Cloud model is not configured. Select a model from the list.
zotseek-pref-cloudRebuildTitle = Index remaining papers with Cloud?
zotseek-pref-cloudRebuildMessage = This will send content from { $count } eligible papers to the configured Cloud provider. Provider charges may apply. Continue?
zotseek-pref-modelBackfillTitle = สร้างดัชนีรายการที่เหลือด้วยโมเดลปัจจุบันหรือไม่?
zotseek-pref-modelBackfillMessage = โมเดลนี้ครอบคลุม { $covered } จาก { $total } รายการ ต้องการสร้างดัชนีอีก { $missing } รายการในเบื้องหลังตอนนี้หรือไม่? คุณยังสามารถใช้ Zotero ต่อได้ระหว่างดำเนินการ
## Context menu items

zotseek-menu-findSimilar = ค้นหาเอกสารที่คล้ายกัน
zotseek-menu-openZotSeek = เปิด ZotSeek…
zotseek-menu-indexSelected = ตรวจสอบและอัปเดตรายการที่เลือก
zotseek-menu-indexCollection = ตรวจสอบและอัปเดตคอลเลกชันปัจจุบัน
zotseek-menu-updateLibrary = ตรวจสอบและอัปเดตดัชนี
zotseek-menu-removeFromIndex = ลบออกจากดัชนี ZotSeek
zotseek-menu-findRelated = ค้นหาเอกสารที่เกี่ยวข้อง

## Toolbar

zotseek-toolbar-openZotSeek = เปิด ZotSeek-U
zotseek-toolbar-findSimilar = ค้นหาเอกสารที่คล้ายกัน

## Preference pane

zotseek-pref-title = ZotSeek-U
zotseek-pref-indexStatistics = สถิติดัชนี
zotseek-pref-papersIndexed = จำนวนเอกสารในดัชนี
zotseek-pref-totalChunks = จำนวนชิ้นข้อมูลทั้งหมด
zotseek-pref-storageUsed = พื้นที่จัดเก็บที่ใช้
zotseek-pref-model = โมเดล:
zotseek-pref-avg = เฉลี่ย:
zotseek-pref-chunksPerPaper = ชิ้นข้อมูล/เอกสาร
zotseek-pref-lastIndexed = จัดทำดัชนีล่าสุด:
zotseek-pref-refreshStats =
    .label = รีเฟรชสถิติ
zotseek-pref-compactDatabase =
    .label = บีบอัดฐานข้อมูล
zotseek-pref-autoCompact =
    .label = บีบอัดโดยอัตโนมัติเมื่อ Zotero ไม่ทำงาน
zotseek-pref-autoCompactDesc = ต้องใช้ Zotero 10 ขึ้นไป จะทำงานเมื่อมีพื้นที่ที่เรียกคืนได้อย่างมีนัยสำคัญและไม่มีการจัดทำดัชนีอยู่
zotseek-pref-indexModeMismatch = โหมดดัชนีไม่ตรงกัน
zotseek-pref-indexModeMismatchDesc = ดัชนีของคุณสร้างด้วยโหมด { $indexedMode } แต่การตั้งค่าปัจจุบันคือ { $currentMode }
zotseek-pref-indexModeMismatchAction = คลิก “ตรวจสอบและอัปเดตดัชนี” ด้านล่างเพื่อใช้โหมดใหม่ ZotSeek จะใช้เวกเตอร์ที่เข้ากันได้ซ้ำและคำนวณเฉพาะส่วนที่ขาด โดยยังเลือก “สร้างดัชนีใหม่” ได้
zotseek-pref-indexingMode = โหมดการจัดทำดัชนี
zotseek-pref-abstractOnly = เฉพาะบทคัดย่อ
zotseek-pref-abstractOnlyMenu =
    .label = เฉพาะบทคัดย่อ (เร็วกว่า)
zotseek-pref-abstractSpeed = เร็ว · ประมาณ 1 ชิ้นข้อมูลต่อเอกสาร
zotseek-pref-abstractDesc = จัดทำดัชนีชื่อเรื่อง บทคัดย่อ และแท็กที่ไม่ขึ้นต้นด้วย #
zotseek-pref-notes = ข้อมูลเมทาดาทา + โน้ต
zotseek-pref-notesMenu =
    .label = ข้อมูลเมทาดาทา + โน้ต (ไม่ประมวลผล PDF)
zotseek-pref-notesSpeed = เน้นเฉพาะสาระ · ไม่ประมวลผล PDF
zotseek-pref-notesDesc = จัดทำดัชนีเมตาดาต้าเดียวกันและโน้ตลูก
zotseek-pref-fullPaper = เอกสารฉบับเต็ม
zotseek-pref-fullPaperMenu =
    .label = เอกสารฉบับเต็ม (ละเอียดกว่า)
zotseek-pref-fullSpeed = ละเอียด · บทคัดย่อ + โน้ต + PDF
zotseek-pref-fullDesc = จัดทำดัชนีเมตาดาต้าเดียวกัน โน้ตลูก และเนื้อหา PDF ฉบับเต็มพร้อมเลขหน้า
zotseek-pref-mcpServer = การเข้าถึงโดย AI Agent
zotseek-pref-mcpServerLabel =
    .label = อนุญาตให้ AI agent ค้นหาและอ่านไลบรารีของคุณ (เซิร์ฟเวอร์ MCP ภายในเครื่อง)
zotseek-pref-mcpServerDesc = ให้ไคลเอนต์ MCP เช่น Claude Code ค้นหาแบบอ่านอย่างเดียว และอ่านข้อมูลเมตาของรายการ โน้ต และเนื้อหา PDF ได้ ทุกอย่างอยู่ในคอมพิวเตอร์เครื่องนี้ (เฉพาะ localhost)
zotseek-pref-mcpServerUrl = เชื่อมต่อด้วย:
zotseek-pref-mcpServerWarning = เซิร์ฟเวอร์ HTTP ภายในเครื่องของ Zotero ถูกปิดใช้งาน เปิด “อนุญาตให้แอปพลิเคชันอื่นบนคอมพิวเตอร์เครื่องนี้สื่อสารกับ Zotero” ใน การตั้งค่า → ขั้นสูง
zotseek-pref-autoIndexing = การบำรุงรักษาอัตโนมัติ
zotseek-pref-autoIndexLabel =
    .label = ตรวจสอบและอัปเดตดัชนีเมื่อ Zotero เริ่มทำงาน
zotseek-pref-autoIndexDesc = ตรวจสอบขอบเขตไลบรารีที่เลือกเมื่อเริ่มต้น อัปเดตรายการที่เพิ่มหรือเปลี่ยนแปลง ลบระเบียนของรายการที่ลบจาก Zotero หรือถูกยกเว้นตามกฎการจัดทำดัชนี และแสดงความคืบหน้าที่มุมขวาล่าง
zotseek-pref-checkNowResult = ตรวจสอบแล้ว { $checked } รายการ; อัปเดตแล้ว { $changed } รายการ; ลบระเบียนดัชนีแล้ว { $removed } รายการ
zotseek-indexing-noteUpdate = กำลังอัปเดตโน้ตสำหรับ { $count } รายการ…
zotseek-indexing-noteUpdateComplete = อัปเดตโน้ตสำหรับ { $count } รายการแล้ว
zotseek-pref-indexScope = ขอบเขตดัชนี
zotseek-pref-indexScopeUser =
    .label = ไลบรารีของฉัน
zotseek-pref-indexScopeAll =
    .label = ไลบรารีทั้งหมด
zotseek-pref-indexScopeDesc = ขอบเขตนี้ใช้กับการดำเนินการ “ตรวจสอบและอัปเดตดัชนี” ด้วยตนเองและการบำรุงรักษาอัตโนมัติเมื่อเริ่มต้น
zotseek-pref-searchSettings = การตั้งค่าการค้นหา
zotseek-pref-resultsToShow = จำนวนผลลัพธ์ที่แสดง
zotseek-pref-resultsToShowDesc = จำนวนรายการที่ตรงกันที่จะแสดง (5–100)
zotseek-pref-minSimilarity = ความคล้ายคลึงขั้นต่ำ
zotseek-pref-minSimilarityDesc = % — กรองรายการที่ตรงกันคุณภาพต่ำออก (0–100)
zotseek-pref-defaultSearchMode = โหมดการค้นหาเริ่มต้น
zotseek-pref-defaultSearchModeDesc = เปลี่ยนโหมดการค้นหาเริ่มต้น
zotseek-pref-advancedSettings = การตั้งค่าขั้นสูง
zotseek-pref-modelInputSettings = การแบ่งส่วนและอินพุตโมเดล
zotseek-pref-modelOptionalHint = (ตั้งค่าเมื่อเลือก)
zotseek-pref-maxTokens = โทเค็นสูงสุดต่อชิ้นข้อมูล
zotseek-pref-maxTokensDesc = ค่าที่ผู้ใช้กำหนดเอง (ไม่บังคับ); นโยบายของโมเดลที่ใช้งานจะกำหนดขีดจำกัดสุดท้าย
zotseek-pref-modelInputPolicy = จำกัด: { $limit } · แนะนำ: { $recommended }
zotseek-pref-modelInputUnknown = เซิร์ฟเวอร์จัดการ
zotseek-pref-modelInputPrefixRequired = จำเป็น
zotseek-pref-modelInputPrefixNone = ไม่มี
zotseek-pref-modelStatusBundled = ในตัว
zotseek-pref-modelStatusInstalled = ติดตั้งแล้ว
zotseek-pref-modelStatusDownload = ต้องดาวน์โหลด · ประมาณ { $size } MB
zotseek-pref-modelMultilingual = หลายภาษา
zotseek-modelDownloadChoiceTitle = ติดตั้งโมเดล embedding
zotseek-modelDownloadChoiceMessage = ยังไม่ได้ติดตั้ง { $model } การดาวน์โหลดอัตโนมัติจะรับข้อมูลประมาณ { $size } MB จาก huggingface.co เพียงครั้งเดียวและเก็บไว้ในคอมพิวเตอร์เครื่องนี้ ZotSeek จะไม่ส่งไลบรารี Zotero ของคุณไปยัง Hugging Face
zotseek-modelDownloadAutomatic = ดาวน์โหลดอัตโนมัติ (แนะนำ)
zotseek-modelDownloadManual = ดาวน์โหลดด้วยตนเอง
zotseek-modelDownloadCancel = ยกเลิก
zotseek-modelDownloadManualTitle = ดาวน์โหลดโมเดลด้วยตนเอง
zotseek-modelDownloadManualMessage = ดาวน์โหลดไฟล์ที่จำเป็นจากหน้าโมเดลอย่างเป็นทางการและบันทึกไว้ในตำแหน่งติดตั้ง โดยคงโครงสร้างโฟลเดอร์ย่อยตามรายการไว้

    โมเดล: { $model }
    หน้าอย่างเป็นทางการ: { $page }

    ไฟล์ที่จำเป็น:
    { $files }

    ตำแหน่งติดตั้ง:
    { $path }
zotseek-modelDownloadOpenPage = เปิดหน้าโมเดล
zotseek-modelDownloadOpenLocation = เปิดตำแหน่งติดตั้ง
zotseek-modelDownloadClose = ปิด
zotseek-modelDownloadStarting = กำลังดาวน์โหลด { $model }…
zotseek-modelDownloadProgress = กำลังดาวน์โหลด { $model }: ไฟล์ที่ { $done } จาก { $total }
zotseek-modelDownloadFailed = การทำงานกับโมเดลล้มเหลว: { $error }
zotseek-modelDownloadRevealFailedTitle = เปิดตำแหน่งติดตั้งไม่ได้
zotseek-modelDownloadRevealFailedMessage = ZotSeek เปิดตำแหน่งติดตั้งโมเดลไม่ได้ คุณสามารถคัดลอกเส้นทางนี้แล้วเปิดด้วยตนเอง:

    { $path }
zotseek-pref-resetMaxTokens =
    .label = ใช้ค่าที่แนะนำ
zotseek-pref-serverConfigTitle = โมเดล Local Server
zotseek-pref-serverConfigDesc = กำหนดค่าโมเดล Local Server แบบคงที่ในเทมเพลต JSON ของโปรไฟล์ ZotSeek จะตรวจสอบเมื่อเริ่มต้น แก้ไขไฟล์แล้วเริ่ม Zotero ใหม่เพื่อใช้การเปลี่ยนแปลง
zotseek-pref-serverConfigPath = เทมเพลต:
zotseek-pref-serverConfigNotLoaded = ยังไม่ได้โหลดเทมเพลต เริ่ม Zotero ใหม่
zotseek-pref-serverConfigLoaded = กำหนดค่า Local Server ({ $model }) แล้ว แก้ไขไฟล์แล้วเริ่ม Zotero ใหม่เพื่อใช้การเปลี่ยนแปลง
zotseek-pref-serverConfigNone = Local Server (NONE): ไม่ได้กำหนดค่าโมเดล Local Server เลือก Local Server ในเมนูโมเดลเพื่อดูคำแนะนำการตั้งค่า
zotseek-pref-serverConfigErrors = Local Server (UNKNOWN): พบข้อผิดพลาดในการกำหนดค่า { $errors } รายการ ตรวจสอบ ID โมเดล URL บริการ loopback ขนาดเวกเตอร์ งบประมาณโทเค็น และคำนำหน้าคิวรี/เอกสารในเทมเพลต
zotseek-pref-serverModelIncomplete = ข้อมูลโมเดล Local Server ไม่ครบถ้วน กำหนดค่าเทมเพลต JSON แล้วเริ่ม Zotero ใหม่
zotseek-serverConfigRequiredTitle = ต้องกำหนดค่าโมเดล Local Server
zotseek-serverConfigRequiredMessage = เลือก Local Server ({ $state }) แล้ว แต่ข้อมูลโมเดลไม่ครบถ้วน ZotSeek จะเก็บตัวเลือกนี้ไว้ แต่ยังจัดทำดัชนีหรือค้นหาเชิงความหมายไม่ได้

    แก้ไข: { $path }

    บันทึกไฟล์แล้วเริ่ม Zotero ใหม่

    { $guidance }
zotseek-serverConfigMissingEntry = ตั้งค่าฟิลด์ “model” ของเทมเพลตให้เป็นออบเจ็กต์โมเดล Local Server ที่ครบถ้วนหนึ่งรายการ
zotseek-serverConfigInvalidEntry = เทมเพลตมีข้อผิดพลาดในการกำหนดค่า { $errors } รายการ ใช้ตัวอย่างในเทมเพลตเพื่อกรอก ID โมเดล URL บริการ loopback ขนาดเวกเตอร์ งบประมาณโทเค็น และคำนำหน้าคิวรี/เอกสารให้ครบ
zotseek-serverConfigOpenLocation = เปิดตำแหน่งไฟล์
    .label = เปิดตำแหน่งไฟล์
zotseek-serverConfigClose = ปิด
zotseek-serverConfigRevealFailedTitle = เปิดตำแหน่งไฟล์ไม่ได้
zotseek-serverConfigRevealFailedMessage = ZotSeek เปิดตำแหน่งไฟล์การกำหนดค่าไม่ได้ คุณสามารถคัดลอกเส้นทางนี้แล้วเปิดด้วยตนเอง:

    { $path }
zotseek-pref-maxChunks = ชิ้นข้อมูลสูงสุดต่อเอกสาร
zotseek-pref-maxChunksDesc = จำกัดสำหรับเอกสารยาว (1–200)
zotseek-pref-excludeBooks =
    .label = ยกเว้นหนังสือจากการจัดทำดัชนี
zotseek-pref-excludeBooksDesc = จะไม่จัดทำดัชนีหนังสือ ดัชนี ZotSeek-U ที่มีอยู่สำหรับหนังสือจะถูกลบในการตรวจสอบดัชนีครั้งถัดไป
zotseek-pref-excludeTag = แท็กที่ยกเว้น
zotseek-pref-excludeTagDesc = รายการที่มีแท็กนี้จะไม่ถูกจัดทำดัชนี ดัชนี ZotSeek-U ที่มีอยู่สำหรับรายการที่ตรงกันจะถูกลบในการตรวจสอบดัชนีครั้งถัดไป เว้นว่างเพื่อปิดใช้งาน
zotseek-pref-actions = การดำเนินการ
zotseek-pref-maintenanceRepair = การบำรุงรักษาและซ่อมแซม
zotseek-pref-updateIndex =
    .label = ตรวจสอบและอัปเดตดัชนี
zotseek-pref-recommended = ✓ แนะนำ
zotseek-pref-updateIndexDesc = เพิ่มรายการที่ขาดหาย อัปเดตรายการที่เมทาดาทา โน้ต หรือการตั้งค่าการจัดทำดัชนีเปลี่ยนแปลง ข้ามรายการที่ไม่เปลี่ยนแปลง และลบระเบียนของรายการที่ลบจาก Zotero หรือถูกยกเว้นตามกฎการจัดทำดัชนี การเปลี่ยนการตั้งค่าการจัดทำดัชนีอาจคำนวณรายการเดิมใหม่
zotseek-pref-rebuildIndex =
    .label = สร้างดัชนีใหม่
zotseek-pref-rebuildIndexDesc = ล้างดัชนีของโมเดลปัจจุบันและจัดทำดัชนีรายการทั้งหมดใหม่ ใช้หลังเปลี่ยนโหมดหรือกลยุทธ์การแบ่งชิ้นข้อมูล
zotseek-pref-clearIndex =
    .label = ล้างดัชนี
zotseek-pref-dangerZone = พื้นที่อันตราย
zotseek-pref-destructive = ⚠ ทำลายข้อมูล
zotseek-pref-clearIndexDesc = ลบ embedding ทั้งหมดออกจากฐานข้อมูล คุณจะต้องจัดทำดัชนีใหม่ภายหลัง
zotseek-pref-about = เกี่ยวกับ
zotseek-pref-githubRepo =
    .value = ที่เก็บ GitHub
zotseek-pref-modelLine = โมเดล: { $model }
zotseek-pref-avgLine = เฉลี่ย: { $avg } ชิ้นข้อมูล/เอกสาร
zotseek-pref-lastIndexedLine = จัดทำดัชนีล่าสุด: { $date }
zotseek-pref-compacted = บีบอัดฐานข้อมูลแล้ว
zotseek-pref-compactionFailed = บีบอัดฐานข้อมูลล้มเหลว
zotseek-pref-healthHeader = สุขภาพฐานข้อมูล
zotseek-pref-healthOrphans = embedding ที่ไม่พบรายการต้นทาง: { $count }
zotseek-pref-healthOrphansDesc = embedding ที่ไม่พบรายการต้นทางในไลบรารีปัจจุบัน การกวาดล้างจะคืนพื้นที่ แต่ไม่สามารถยกเลิกได้
zotseek-pref-healthPurgeOrphans =
    .label = กวาดล้างรายการกำพร้า
zotseek-pref-healthPurgeConfirmTitle = กวาดล้าง embedding ที่ไม่พบรายการต้นทาง
zotseek-pref-healthPurgeConfirmMsg = การดำเนินการนี้จะลบ embedding ของรายการที่ไม่พบในไลบรารี Zotero ปัจจุบันอย่างถาวร ดำเนินการต่อหรือไม่?
zotseek-pref-healthPurgeDoneTitle = กวาดล้างรายการกำพร้าแล้ว
zotseek-pref-healthPurgeDoneMsg = ลบรายการที่ไม่พบรายการต้นทางแล้ว { $count } รายการ
zotseek-pref-healthPurgeFailedTitle = กวาดล้างล้มเหลว

## Search dialog

zotseek-search-search =
    .value = ค้นหา:
zotseek-search-placeholder =
    .placeholder = ป้อนคำค้นหา (ค้นหาอัตโนมัติขณะพิมพ์)… | ตัวอย่าง: งานวิจัยที่เชื่อมโยงความเครียดในการเลี้ยงดูที่สูงขึ้นกับการประสานสมองระหว่างพ่อแม่และลูกที่ลดลง
zotseek-search-addQuery =
    .label = +
    .tooltiptext = เพิ่มคำค้นหาเพื่อรวมแบบ AND/OR
zotseek-search-searchBtn =
    .label = ค้นหา
zotseek-search-and =
    .label = AND
zotseek-search-or =
    .label = OR
zotseek-search-using =
    .value = โดยใช้
zotseek-search-minimum =
    .label = ขั้นต่ำ
zotseek-search-product =
    .label = ผลคูณ
zotseek-search-average =
    .label = ค่าเฉลี่ย
zotseek-search-andDesc =
    .value = — ผลลัพธ์ต้องตรงกับทั้งสองคำค้นหา
zotseek-search-query2 =
    .value = คำค้นหา 2:
zotseek-search-query3 =
    .value = คำค้นหา 3:
zotseek-search-query4 =
    .value = คำค้นหา 4:
zotseek-search-enterQuery = ป้อนคำค้นหา { $n }…
zotseek-search-removeQuery =
    .label = ✕
    .tooltiptext = ลบคำค้นหานี้
zotseek-search-mode =
    .value = โหมด:
zotseek-search-modeHybrid =
    .label = 🔗 ไฮบริด (แนะนำ)
zotseek-search-modeSemantic =
    .label = 🧠 เชิงความหมายเท่านั้น
zotseek-search-modeKeyword =
    .label = 🔤 คำสำคัญเท่านั้น
zotseek-search-modeDesc =
    .value = ประเภทการจับคู่: 🔗 การค้นหาทั้งสองแบบ · 🧠 จับคู่ด้วย AI · 🔤 จับคู่ด้วยคำสำคัญ
zotseek-search-results =
    .value = ผลลัพธ์:
zotseek-search-bySection = ตามส่วน
zotseek-search-byLocation = ตามตำแหน่ง (หน้าที่แน่นอนและย่อหน้า)
zotseek-search-settings =
    .label = ⚙ การตั้งค่า
    .tooltiptext = เปิดการตั้งค่า ZotSeek
zotseek-search-openSelected =
    .label = เปิดรายการที่เลือก
zotseek-search-close =
    .label = ปิด
zotseek-search-initializing = กำลังเริ่มต้นการค้นหา…
zotseek-search-hybrid = ไฮบริด
zotseek-search-semantic = เชิงความหมาย
zotseek-search-keyword = คำสำคัญ
zotseek-search-loadingModel = กำลังโหลดโมเดล AI (ครั้งแรกอาจใช้เวลาสักครู่)…
zotseek-search-finding = การค้นหาแบบ { $mode }: กำลังค้นหารายการ…
zotseek-search-findingMulti = การค้นหาแบบ { $mode } ({ $op }): กำลังค้นหารายการ…
zotseek-search-noItemsFound = ไม่พบรายการ
zotseek-search-showInLibrary = แสดงในไลบรารี
zotseek-search-showItemsInLibrary = แสดง { $count } รายการในไลบรารี
zotseek-search-addToCollection = เพิ่มไปยังคอลเลกชัน
zotseek-search-noCollections = ไม่มีคอลเลกชัน
zotseek-search-moreCollections = … และอีก { $count } คอลเลกชัน
zotseek-search-foundItems = พบ { $count } รายการ
zotseek-search-foundItemsFromMatches = พบ { $count } รายการ (จาก { $matches } รายการที่ตรงกัน)
zotseek-search-foundItemsQuery = พบ { $count } รายการ ({ $query })
zotseek-search-searching = กำลังค้นหา…
zotseek-search-searchLabel = ค้นหา
zotseek-search-searchingMoment = กำลังค้นหาในอีกสักครู่…
zotseek-search-queryTooShort = ป้อนอักขระ CJK อย่างน้อย 2 ตัว หรืออักขระอื่นอย่างน้อย 3 ตัว
zotseek-search-failed = ค้นหาล้มเหลว: { $error }
zotseek-search-noItemsMatchingAll = ไม่พบรายการที่ตรงกับคำค้นหาทั้งหมด
zotseek-search-matchBoth = — ผลลัพธ์ต้องตรงกับทั้งสองคำค้นหา
zotseek-search-matchAll = — ผลลัพธ์ต้องตรงกับคำค้นหาทั้งหมด
zotseek-search-matchAny = — ผลลัพธ์อาจตรงกับคำค้นหาใดก็ได้

## Results table columns

zotseek-column-match = ความตรงกัน
zotseek-column-title = ชื่อเรื่อง
zotseek-column-authors = ผู้เขียน
zotseek-column-year = ปี
zotseek-column-location = ตำแหน่ง
zotseek-column-section = ส่วน

## Source labels

zotseek-source-abstract = บทคัดย่อ
zotseek-source-fulltext = ข้อความฉบับเต็ม
zotseek-source-title = ชื่อเรื่อง
zotseek-source-methods = วิธีการ
zotseek-source-results = ผลลัพธ์
zotseek-source-content = เนื้อหา
zotseek-source-note = โน้ต
zotseek-search-hybrid-menuitem =
    .label = 🔗 ไฮบริด (แนะนำ)
zotseek-search-semantic-menuitem =
    .label = 🧠 เชิงความหมายเท่านั้น
zotseek-search-keyword-menuitem =
    .label = 🔤 คำสำคัญเท่านั้น

## Similar documents dialog

zotseek-similar-title =
    .title = ค้นหาเอกสารที่คล้ายกัน
zotseek-similar-similarTo = คล้ายกับ:{ " " }
zotseek-similar-loading = กำลังโหลด…
zotseek-similar-openSelected =
    .label = เปิดรายการที่เลือก
zotseek-similar-close =
    .label = ปิด
zotseek-similar-initFailed = เริ่มต้นไม่สำเร็จ: { $error }
zotseek-similar-noSource = ไม่ได้เลือกเอกสารต้นทาง
zotseek-similar-finding = กำลังค้นหาเอกสารที่คล้ายกัน…
zotseek-similar-loadingModel = กำลังโหลดโมเดล AI…
zotseek-similar-searching = กำลังค้นหา…
zotseek-similar-noResults = ไม่พบเอกสารที่คล้ายกัน
zotseek-similar-found = พบเอกสารที่คล้ายกัน { $count } รายการ
zotseek-similar-searchFailed = ค้นหาล้มเหลว: { $error }

## Indexing progress

zotseek-indexing-title = การจัดทำดัชนี ZotSeek
zotseek-indexing-clearTitle = กำลังล้างดัชนี ZotSeek
zotseek-indexing-clearConfirmTitle = ล้างดัชนี ZotSeek
zotseek-indexing-clearConfirmMsg = การดำเนินการนี้จะลบ embedding ที่จัดเก็บไว้ทั้งหมด คุณจะต้องจัดทำดัชนีไลบรารีใหม่

    ดำเนินการต่อหรือไม่?
zotseek-indexing-clearConfirmButton = ล้างดัชนี
zotseek-indexing-initStorage = กำลังเริ่มต้นพื้นที่จัดเก็บ…
zotseek-indexing-deletingAll = กำลังลบ embedding ทั้งหมด…
zotseek-indexing-clearedSuccess = ล้างดัชนีเรียบร้อยแล้ว!
zotseek-indexing-clearedMsg = ล้างดัชนีเรียบร้อยแล้ว

    ตอนนี้คุณสามารถจัดทำดัชนีไลบรารีใหม่ได้
zotseek-indexing-rebuildTitle = สร้างดัชนี ZotSeek ใหม่
zotseek-indexing-rebuildConfirmTitle = สร้างดัชนี ZotSeek ใหม่
zotseek-indexing-rebuildConfirmMsg = การดำเนินการนี้จะลบ embedding ของโมเดลปัจจุบันและสร้างดัชนีใหม่ โดยเก็บดัชนีของโมเดลอื่นไว้
zotseek-indexing-rebuildConfirmButton = สร้างดัชนีใหม่
zotseek-indexing-chunkStrategyRebuildRequired = ZotSeek ตรวจพบว่าดัชนีของโมเดลปัจจุบันใช้กลยุทธ์การแบ่งชิ้นข้อมูลรุ่นเก่า
    ดัชนีที่มีอยู่ยังค้นหาได้ แต่จะหยุดการอัปเดตส่วนเพิ่มเบื้องหลังเพื่อป้องกันการผสมชิ้นข้อมูลเก่าและใหม่ ใช้ “สร้างดัชนีใหม่” ในการตั้งค่าเพื่อสร้างใหม่ทั้งหมด การปิดประกาศนี้จะไม่เริ่มสร้างใหม่และไม่แก้ไขดัชนีที่มีอยู่
    การสร้างดัชนีใหม่อาจใช้เวลาตั้งแต่หลายสิบนาทีถึงหลายชั่วโมง ขึ้นอยู่กับขนาดไลบรารีและกลยุทธ์การสร้างดัชนี
zotseek-indexing-rebuildingTitle = กำลังสร้างดัชนี ZotSeek ใหม่
zotseek-indexing-clearingExisting = กำลังล้างดัชนีที่มีอยู่…
zotseek-indexing-existingCleared = ✓ ล้างดัชนีของโมเดลปัจจุบันแล้ว
zotseek-indexing-loading = กำลังโหลด…
zotseek-indexing-alreadyInProgress = กำลังจัดทำดัชนีอยู่แล้ว…
zotseek-indexing-selectItems = โปรดเลือกรายการที่จะจัดทำดัชนี
zotseek-indexing-selectCollection = โปรดเลือกคอลเลกชันก่อน

    (คลิกคอลเลกชันในแถบด้านซ้าย)
zotseek-indexing-emptyCollection = คอลเลกชัน “{ $name }” ไม่มีรายการให้จัดทำดัชนี
zotseek-indexing-emptyCollections = คอลเลกชันที่เลือก { $count } คอลเลกชันไม่มีรายการให้จัดทำดัชนี
zotseek-indexing-updateTitle = ZotSeek - ตรวจสอบและอัปเดตดัชนี
zotseek-indexing-updateConfirmMsg = ตรวจสอบและอัปเดตดัชนีสำหรับ { $scope } หรือไม่? ZotSeek จะเพิ่มรายการที่ขาดหาย อัปเดตรายการที่เมทาดาทา โน้ต หรือการตั้งค่าการจัดทำดัชนีเปลี่ยนแปลง ข้ามรายการที่ไม่เปลี่ยนแปลง และลบระเบียนของรายการที่ลบจาก Zotero หรือถูกยกเว้นตามกฎการจัดทำดัชนี การเปลี่ยนการตั้งค่าการจัดทำดัชนีอาจคำนวณรายการเดิมใหม่ด้วยการตั้งค่าปัจจุบัน
zotseek-indexing-updateConfirmButton = ตรวจสอบและอัปเดต
zotseek-indexing-confirmCancel = ยกเลิก
zotseek-indexing-scopeUser = ไลบรารีส่วนตัวของคุณ
zotseek-indexing-scopeAll = ไลบรารีทั้งหมดของคุณ (ส่วนตัว + กลุ่ม)

zotseek-indexing-configChangeTitle = ZotSeek - การตั้งค่าดัชนีเปลี่ยนแปลง
zotseek-indexing-configChangeMessage = การตั้งค่าการจัดทำดัชนีของรายการที่จัดทำดัชนีแล้ว { $affected } รายการใน { $scope } เปลี่ยนแปลง; ต้องคำนวณ embedding ใหม่ { $rebuildRequired } รายการ ส่วนรายการที่เหลือเพียงต้องอัปเดตระเบียนการกำหนดค่า ก่อนเลือก ZotSeek จะไม่ลบระเบียน อัปเดตลายนิ้วมือ หรือเขียน embedding ควรดำเนินการตรวจสอบเมื่อเริ่มต้นอย่างไร?
zotseek-indexing-configChangeUpdate = ตรวจสอบและอัปเดตดัชนี
zotseek-indexing-configChangeRebuild = สร้างดัชนีใหม่
zotseek-indexing-configChangeCancel = ยกเลิก

# Auto-resume prompt shown at startup when a previous bulk-index run was interrupted.
zotseek-resume-title = ZotSeek - ดำเนินการจัดทำดัชนีต่อ
zotseek-resume-message = การจัดทำดัชนีก่อนหน้านี้ถูกขัดจังหวะ ZotSeek จะตรวจสอบรายการทั้งหมด { $count } รายการอีกครั้งใน { $scope } และดำเนินการอัปเดตที่ยังไม่เสร็จหรือมีข้อผิดพลาดต่อ รายการที่เป็นปัจจุบันแล้วจะถูกข้าม หากยกเลิก การบำรุงรักษาดัชนีอัตโนมัติจะถูกข้ามในการเริ่มต้นครั้งนี้ด้วย ดำเนินการต่อทันทีหรือไม่?
zotseek-resume-confirm = ดำเนินการจัดทำดัชนีต่อ
zotseek-resume-scopeLibrary = ไลบรารีของคุณ
zotseek-resume-scopeUserLibrary = ไลบรารีส่วนตัวของคุณ
zotseek-resume-scopeCollection = คอลเลกชัน “{ $name }”
zotseek-resume-scopeCollections = คอลเลกชันที่เลือก { $count } คอลเลกชัน
zotseek-resume-scopeItems = ขอบเขตรายการที่เลือก
zotseek-indexing-noItemsSelected = ไม่ได้เลือกรายการ
zotseek-indexing-removedItems = ลบรายการ { $count } รายการออกจากดัชนีแล้ว
zotseek-indexing-notInIndex = รายการที่เลือกไม่มีอยู่ในดัชนี
zotseek-indexing-removeFailed = ลบออกจากดัชนีไม่สำเร็จ
zotseek-indexing-mode = โหมดการจัดทำดัชนี: { $mode }
zotseek-indexing-checking = กำลังตรวจสอบรายการที่มีอยู่ในดัชนี…
zotseek-indexing-skippedExcluded = ✓ ข้ามรายการที่ยกเว้น { $count } รายการ
zotseek-indexing-skippedIndexed = ✓ ข้ามรายการที่มีอยู่ในดัชนีแล้ว { $count } รายการ
zotseek-indexing-allIndexed = รายการทั้งหมดอยู่ในดัชนีแล้ว!
zotseek-indexing-allInIndex = ✓ มีรายการ { $count } รายการอยู่ในดัชนีแล้ว
zotseek-indexing-nothingToIndex = ไม่มีรายการให้จัดทำดัชนี — รายการทั้งหมดเป็นปัจจุบันแล้ว!
zotseek-indexing-loadingModel = กำลังโหลดโมเดล AI (Transformers.js)…
zotseek-indexing-modelLoaded = ✓ โหลดโมเดล AI แล้ว
zotseek-indexing-batchExtracting = ชุดที่ { $current }/{ $total }: กำลังแยกข้อความ…
zotseek-indexing-batchEmbedding = ชุดที่ { $current }/{ $total }: กำลังสร้าง embedding…
zotseek-indexing-batchEmbeddingChunks = ชุดที่ { $current }/{ $total }: กำลังสร้าง embedding ให้ชิ้นข้อมูล
zotseek-indexing-chunksFailed = ⚠ ข้ามชิ้นข้อมูล { $count } ชิ้นใน: { $items }
zotseek-indexing-batchSaving = ชุดที่ { $current }/{ $total }: กำลังบันทึกจุดตรวจ…
zotseek-indexing-checkpoint = ✓ จุดตรวจ { $current }/{ $total }: บันทึกแล้ว { $items } รายการ, { $chunks } ชิ้นข้อมูล
zotseek-indexing-complete = จัดทำดัชนีเสร็จสมบูรณ์!
zotseek-indexing-completeMode = ✓ โหมด: { $mode }
zotseek-indexing-completePrevious = ✓ จัดทำดัชนีไว้ก่อนหน้า: { $count } รายการ
zotseek-indexing-completeNew = ✓ จัดทำดัชนีใหม่: { $count } รายการ
zotseek-indexing-completeChunks = ✓ จำนวนชิ้นข้อมูลทั้งหมด: { $count }
zotseek-indexing-completeAvg = ✓ ชิ้นข้อมูล/รายการโดยเฉลี่ย: { $avg }
zotseek-indexing-completeDuration = ✓ ระยะเวลา: { $duration }
zotseek-indexing-completeNoContent = ⚠ ไม่มีเนื้อหา: { $count } รายการ
zotseek-indexing-completeTruncated = ⚠ เนื้อหาไม่ครบ: รายการ { $count } รายการถึงขีดจำกัดชิ้นข้อมูลสูงสุดต่อเอกสาร เพิ่มขีดจำกัดหรือเปลี่ยนเป็นโหมดสรุปเพื่อจัดทำดัชนีข้อความเต็ม
zotseek-indexing-completeSuccess = จัดทำดัชนีเสร็จเรียบร้อยแล้ว!
zotseek-indexing-cancelled = ยกเลิกการจัดทำดัชนีแล้ว
zotseek-indexing-pauseAction = หยุดพักการจัดทำดัชนี
zotseek-indexing-pausingAction = กำลังหยุดพัก…
zotseek-indexing-pauseTooltip = หยุดหลังจุดตรวจที่ปลอดภัยปัจจุบัน และดำเนินการต่อครั้งถัดไปที่ Zotero เริ่มทำงาน
zotseek-indexing-paused = หยุดพักการจัดทำดัชนีแล้ว ZotSeek จะเสนอให้ดำเนินการต่อในขอบเขตเดิมทุกประการเมื่อ Zotero เริ่มทำงานครั้งถัดไป
zotseek-indexing-failed = จัดทำดัชนีล้มเหลว: { $error }
zotseek-indexing-progressTitle = ZotSeek
zotseek-indexing-progressItem = กำลังจัดทำดัชนี: { $title }
zotseek-indexing-progressLoadingModel = กำลังโหลดโมเดล…
zotseek-indexing-allExcluded = รายการทั้งหมดถูกยกเว้นจากการจัดทำดัชนี
zotseek-indexing-extracting = กำลังแยกข้อมูล…
zotseek-indexing-noContent = ✗ ไม่พบเนื้อหา
zotseek-indexing-embedding = กำลังสร้าง embedding { $current }/{ $total }…
zotseek-indexing-saving = กำลังบันทึก…
zotseek-indexing-chunksIndexed = ✓ จัดทำดัชนีแล้ว { $count } ชิ้นข้อมูล
zotseek-indexing-chunksIndexedWithFailed = ✓ จัดทำดัชนีแล้ว { $count } ชิ้นข้อมูล (ล้มเหลว { $failed } รายการ)

## Export to Collection (issue #28)

# Keys referenced via data-l10n-id on XUL elements use the .attr = value form
# so Fluent sets the named attribute instead of wiping the element's children.
# Keys consumed via formatValueSync / getString() from JS stay as plain key = text.

zotseek-export-saveAsCollection =
    .label = บันทึกผลลัพธ์เป็นคอลเลกชัน
zotseek-export-addToCollectionNew =
    .label = คอลเลกชันใหม่…
zotseek-export-dialogTitle =
    .title = บันทึกผลลัพธ์เป็นคอลเลกชัน
zotseek-export-nameLabel =
    .value = ชื่อคอลเลกชัน:
zotseek-export-libraryLabel =
    .value = ไลบรารี:
zotseek-export-ok =
    .label = บันทึก
zotseek-export-cancel =
    .label = ยกเลิก
zotseek-export-itemcountSimple = { $count } รายการ → { $destination }
zotseek-export-itemcountFiltered = { $kept } จาก { $total } รายการ → { $destination } (ข้าม: { $reasons })
zotseek-export-reasonOtherLibrary = { $count } รายการอยู่ในไลบรารีอื่น
zotseek-export-reasonDeleted = ลบแล้ว { $count } รายการ
zotseek-export-itemcountEmpty = ไม่มีรายการให้เพิ่ม
zotseek-export-statusExported = เพิ่ม { $count } รายการไปยัง “{ $name }” แล้ว
zotseek-export-statusExportedSkipped = เพิ่ม { $count } รายการไปยัง “{ $name }” แล้ว ข้าม { $skipped } รายการ
zotseek-export-statusFailed = บันทึกผลลัพธ์เป็นคอลเลกชันไม่สำเร็จ

## Preference group headers

zotseek-prefs-group-status = สถานะ
zotseek-prefs-group-models = โมเดล
zotseek-prefs-group-indexing = การจัดทำดัชนี
zotseek-prefs-group-search = การค้นหา
zotseek-prefs-group-maintenance = การผสานรวมและการบำรุงรักษา
zotseek-prefs-exclusions = การยกเว้น

## Model section headers (fallbacks existed in XHTML only; adds the missing ftl entries)

zotseek-pref-embeddingModelTitle = โมเดล Embedding
zotseek-pref-manageModelsTitle = จัดการโมเดลที่ติดตั้ง
zotseek-indexing-cloudRebuildConfirmTitle = Rebuild Cloud index?
zotseek-indexing-cloudRebuildConfirmMsg = About { $count } papers in { $scope } will be sent to the configured Cloud provider and may incur provider charges. Existing complete indexes are kept until each paper is replaced successfully. Continue?
zotseek-indexing-cloudStrategyRebuildConfirmMsg = The current Cloud index uses an older chunk strategy. Its existing embeddings must be deleted before about { $count } papers in { $scope } are sent again, which may incur provider charges. Other model indexes are kept. Continue?

## การตั้งค่าบทสรุปวรรณกรรม

zotseek-prefs-group-brief = บทสรุปวรรณกรรม (ทดลอง)
zotseek-pref-brief-title = บทสรุปวรรณกรรม
zotseek-pref-brief-enabled =
    .label = เปิดใช้บทสรุปวรรณกรรม
zotseek-pref-brief-enabled-desc = สร้างบทสรุปวรรณกรรมแบบทดลองจาก PDF ของบทความเมื่อร้องขอ
zotseek-pref-brief-provider = ผู้ให้บริการที่ใช้ร่วมกัน
zotseek-pref-brief-open-cloud-settings = ตั้งค่าข้อมูลรับรอง
zotseek-pref-brief-model = โมเดลสำหรับสร้างเนื้อหา
zotseek-pref-brief-test = ทดสอบการเชื่อมต่อ
zotseek-pref-brief-create-prompts = สร้างพรอมต์บทสรุปของฉัน…
zotseek-pref-brief-create-prompts-desc = สร้างพรอมต์เป็นคู่สำหรับบทความทั่วไปและบทความทบทวนหรือทฤษฎี
zotseek-pref-brief-standard-prompt = พรอมต์สำหรับบทความทั่วไป
zotseek-pref-brief-review-prompt = พรอมต์สำหรับบทความทบทวน/ทฤษฎี
zotseek-pref-brief-advanced = ขั้นสูง
zotseek-pref-brief-import-standard = นำเข้าพรอมต์มาตรฐาน…
zotseek-pref-brief-import-review = นำเข้าพรอมต์บทความทบทวน…
zotseek-pref-brief-reset-prompts = เรียกคืนพรอมต์ในตัว
zotseek-pref-brief-max-input = โทเค็นอินพุตสูงสุด
zotseek-pref-brief-max-input-desc = งบประมาณอินพุตของโมเดลสำหรับสร้างเนื้อหา
zotseek-pref-brief-max-output = โทเค็นเอาต์พุตสูงสุด
zotseek-pref-brief-max-output-desc = งบประมาณเอาต์พุตที่สงวนไว้สำหรับการสร้างเนื้อหา
zotseek-pref-brief-thinking-enabled =
    .label = เปิดใช้การให้เหตุผลแบบขยาย

## ตัวช่วยสร้างพรอมต์บทสรุปวรรณกรรม

zotseek-brief-prompt-wizard-title = ปรับแต่งพรอมต์บทสรุปวรรณกรรม
zotseek-brief-prompt-wizard-domain-label = หัวข้อหรือสาขาวิจัย
zotseek-brief-prompt-wizard-language-label = ภาษาผลลัพธ์
zotseek-brief-prompt-wizard-habits-label = ความต้องการด้านการอ่านและการวิเคราะห์
zotseek-brief-prompt-wizard-location-label = ตำแหน่งพรอมต์
zotseek-brief-prompt-wizard-open-location = เปิดโฟลเดอร์พรอมต์
zotseek-brief-prompt-wizard-cancel = ยกเลิก

## สถานะและการยินยอมสำหรับบทสรุปวรรณกรรม

zotseek-pref-brief-prompt-bundled = ในตัว ({ $file })
zotseek-pref-brief-prompt-time-unknown = ไม่ทราบเวลาที่อัปเดต
zotseek-pref-brief-prompt-custom = กำหนดเอง ({ $file }) อัปเดตเมื่อ { $updated }
zotseek-pref-brief-provider-summary = ผู้ให้บริการ: { $provider } · ข้อมูลรับรอง: { $credential }
zotseek-pref-brief-key-configured = กำหนดค่า API key แล้ว
zotseek-pref-brief-key-missing = ยังไม่ได้กำหนดค่า API key
zotseek-pref-brief-unsupported-provider = ขณะนี้บทสรุปวรรณกรรมรองรับเฉพาะ Alibaba Bailian
zotseek-pref-brief-key-required = กำหนดค่า Alibaba Bailian API key ก่อนใช้บทสรุปวรรณกรรม
zotseek-pref-brief-connection-verified = ยืนยันการเชื่อมต่อแล้ว
zotseek-pref-brief-connection-not-verified = ยังไม่ได้ยืนยันการเชื่อมต่อ
zotseek-pref-brief-invalid-settings = การตั้งค่าบทสรุปไม่ถูกต้อง: { $error }
zotseek-pref-brief-status-failed = สร้างบทสรุปไม่สำเร็จ: { $error }
zotseek-pref-brief-settings-saved = บันทึกการตั้งค่าบทสรุปแล้ว
zotseek-pref-brief-cancelling = กำลังยกเลิกการสร้างบทสรุป…
zotseek-pref-brief-consent-title = อนุญาตให้สร้างบทสรุปวรรณกรรมหรือไม่
zotseek-pref-brief-test-consent-title = ทดสอบการเชื่อมต่อบทสรุปวรรณกรรมหรือไม่
zotseek-pref-brief-test-consent-message = การทดสอบนี้ส่งเฉพาะข้อความทดสอบคงที่ไปยัง { $provider } และอาจมีค่าใช้จ่าย API เล็กน้อย โดยไม่ส่งบทความ โน้ต หรือเส้นทางไฟล์ ดำเนินการต่อหรือไม่
zotseek-pref-brief-consent-message = เพื่อสร้างบทสรุป ZotSeek จะส่งชื่อเรื่อง บทคัดย่อ และข้อความจากหน้า PDF ของบทความไปยัง { $provider } เมื่อสร้างเทมเพลตพรอมต์ ระบบจะส่งเทมเพลตสองชุดและคำตอบจากแบบฟอร์มของคุณ บัญชี BYOK ของคุณอาจมีค่าใช้จ่าย และการทดสอบการเชื่อมต่อก็อาจมีค่าใช้จ่ายเล็กน้อย ดำเนินการต่อหรือไม่
zotseek-pref-brief-testing = กำลังทดสอบการเชื่อมต่อ…
zotseek-pref-brief-test-failed = ทดสอบการเชื่อมต่อไม่สำเร็จ: { $error }
zotseek-pref-brief-connection-required = ยืนยันการเชื่อมต่อก่อนสร้างบทสรุป
zotseek-pref-brief-import-failed = นำเข้าพรอมต์ไม่สำเร็จ: { $error }
zotseek-pref-brief-reset-title = เรียกคืนพรอมต์ในตัวหรือไม่
zotseek-pref-brief-reset-message = พรอมต์ที่กำหนดเองจะถูกแทนที่ด้วยพรอมต์ในตัว ดำเนินการต่อหรือไม่
zotseek-pref-brief-reset-done = เรียกคืนพรอมต์ในตัวแล้ว

## Literature brief menu and runtime status

zotseek-menu-generateBrief = สร้างบทสรุปวรรณกรรม
zotseek-brief-disabled = ปิดใช้บทสรุปวรรณกรรมแล้ว
zotseek-brief-busy = งานบทสรุปวรรณกรรมอื่นกำลังทำงานอยู่
zotseek-brief-connection-required = ยืนยันการเชื่อมต่อบทสรุปวรรณกรรมก่อนสร้าง
zotseek-brief-start-failed = เริ่มสร้างบทสรุปวรรณกรรมไม่สำเร็จ: { $error }
zotseek-brief-cancelling = กำลังยกเลิกการสร้างบทสรุปวรรณกรรม…
zotseek-brief-cancel-task = ยกเลิกงาน
zotseek-brief-cancel-tooltip = ยกเลิกงานบทสรุปวรรณกรรมนี้
zotseek-brief-progress-title = กำลังสร้างบทสรุปวรรณกรรม
zotseek-brief-progress-summary = เสร็จสิ้น { $completed } จาก { $total } · สำเร็จ: { $success } · ล้มเหลว: { $failed } · ข้าม: { $skipped } · ยกเลิก: { $cancelled }
zotseek-brief-progress-active = กำลังประมวลผล: { $title }
zotseek-brief-progress-latest = { $title }: { $status }
zotseek-brief-progress-latest-with-reason = { $title }: { $status } ({ $reason })
zotseek-brief-progress-complete = งานบทสรุปวรรณกรรมเสร็จสิ้น
zotseek-brief-summary-title = ผลลัพธ์บทสรุปวรรณกรรม
zotseek-brief-summary-message = สำเร็จ: { $success } · ล้มเหลว: { $failed } · ข้าม: { $skipped } · ยกเลิก: { $cancelled }
zotseek-brief-usage-heading = การใช้ Token ที่ผู้ให้บริการรายงาน:
zotseek-brief-usage-input = อินพุต: { $tokens }
zotseek-brief-usage-output = เอาต์พุต: { $tokens }
zotseek-brief-usage-reasoning = การให้เหตุผล: { $tokens } (แสดงแยกและไม่นำมาบวกซ้ำ)
zotseek-brief-usage-total = รวม: { $tokens }
zotseek-brief-usage-total-unavailable = รวม: ผู้ให้บริการไม่ส่งค่าที่ใช้งานได้
zotseek-brief-usage-requests = ได้รับข้อมูลการใช้: { $reported } จาก { $total } คำขอ
zotseek-brief-usage-incomplete = อีก { $count } คำขอไม่ส่งข้อมูลการใช้ ตัวเลขอาจไม่ครบถ้วนและไม่ใช่ใบแจ้งหนี้สุดท้าย
zotseek-brief-status-success = สำเร็จ
zotseek-brief-status-failed = ล้มเหลว
zotseek-brief-status-skipped = ข้าม
zotseek-brief-status-cancelled = ยกเลิก
zotseek-brief-skip-reason-insufficient-text = ไม่มีข้อความ PDF ที่แยกได้
zotseek-brief-skip-reason-existing-note = มีโน้ตลูกอยู่แล้ว
zotseek-brief-skip-reason-no-main-pdf = ไม่มี PDF หลัก
zotseek-brief-select-one = เลือกบทความทั่วไปหรือไฟล์แนบ PDF หนึ่งรายการ
zotseek-brief-invalid-selection = รายการที่เลือกไม่ใช่บทความหรือไฟล์แนบ PDF ที่ใช้ได้
zotseek-brief-existing-note-title = โน้ตบทสรุปที่มีอยู่
zotseek-brief-existing-note-message = บทความนี้มีโน้ตลูกอยู่แล้ว ต้องการสร้างโน้ตบทสรุปวรรณกรรมเพิ่มหรือไม่
zotseek-brief-select-collection = เลือกคอลเลกชันก่อน
zotseek-brief-no-eligible = ไม่พบบทความที่ใช้ได้ในคอลเลกชันที่เลือก
zotseek-brief-preparation-changed = ผู้ให้บริการ โมเดล หรือขีดจำกัดเอาต์พุตเปลี่ยนระหว่างการเตรียม โปรดเริ่มสร้างใหม่และยืนยันอีกครั้ง
zotseek-brief-generation-confirm-title = ยืนยันการส่งและสร้างบทสรุปวรรณกรรมหรือไม่
zotseek-brief-generation-confirm-message = สร้างบทสรุปสำหรับ { $count } บทความและส่งชื่อเรื่อง บทคัดย่อ และข้อความหน้า PDF ไปยัง { $provider } (โมเดล: { $model }) อินพุตโดยประมาณ { $inputTokens } tokens; ขีดจำกัดเอาต์พุตต่อคำขอ { $outputTokens } tokens; คาดว่าอย่างน้อย { $requests } คำขอ ค่านี้เป็นเพียงการประมาณ บัญชี BYOK อาจมีค่าใช้จ่าย และการใช้จริงกับการเรียกเก็บเงินขึ้นอยู่กับผู้ให้บริการ ดำเนินการต่อหรือไม่

## Literature brief prompt wizard runtime status

zotseek-brief-wizard-unavailable = เริ่มไม่ได้: บริการบทสรุปวรรณกรรมไม่พร้อมใช้งาน
zotseek-brief-wizard-generating = กำลังสร้างไฟล์พรอมต์แบบคู่…
zotseek-brief-wizard-required = ระบุสาขาวิจัยและภาษาผลลัพธ์
zotseek-brief-wizard-invalid-result = บริการบทสรุปวรรณกรรมไม่ส่งผลลัพธ์ที่ใช้ได้กลับมา
zotseek-brief-wizard-success = สร้างไฟล์พรอมต์สำเร็จ
zotseek-brief-wizard-success-no-path = สร้างไฟล์พรอมต์สำเร็จ แต่ไม่ได้รับตำแหน่งผลลัพธ์
zotseek-brief-wizard-downloaded-not-enabled = ดาวน์โหลดไฟล์พรอมต์แล้ว แต่ไม่สามารถเปิดใช้คู่ที่จัดการไว้ได้ โปรดลองอีกครั้งหรือนำเข้าไฟล์ด้วยตนเอง
zotseek-brief-wizard-canceled = ยกเลิกการสร้างแล้ว
zotseek-brief-wizard-canceling = กำลังยกเลิกการสร้าง…
zotseek-brief-wizard-failed = สร้างไม่สำเร็จ ไม่มีการเปิดใช้ไฟล์พรอมต์
zotseek-brief-wizard-open-failed = เปิดตำแหน่งไฟล์พรอมต์ไม่สำเร็จ
zotseek-brief-wizard-init-failed = เริ่มตัวช่วยสร้างพรอมต์บทสรุปวรรณกรรมไม่สำเร็จ
zotseek-search-itemNotFound = ไม่พบรายการ
zotseek-pref-brief-refresh-models = Refresh models
zotseek-pref-brief-models-loading = Loading models available to the current provider…
zotseek-pref-brief-models-loaded = Loaded { $count } candidate models; a connection test is still required.
zotseek-pref-brief-models-empty = No candidate models were found. You can still enter a model ID manually.
zotseek-pref-brief-models-failed = Could not load models: { $error }. You can still enter and test a model manually.
zotseek-brief-wizard-service-title = Connect a brief generation model
zotseek-brief-wizard-service-desc = Briefs inherit the provider and API key from Cloud settings. Choose and test only the generation model here.
zotseek-brief-wizard-consent =
    .label = I agree to send connection-test and prompt-customization requests to the current Cloud provider
zotseek-brief-wizard-consent-desc = The test sends fixed text only. Customization sends the two built-in templates and your answers, never papers, notes, or file paths.
zotseek-brief-wizard-provider-summary = { $provider } · { $credential }
zotseek-brief-wizard-model-required = Enter a brief generation model.
zotseek-brief-wizard-consent-required = Confirm the narrow disclosure before testing the connection or customizing prompts.
zotseek-brief-wizard-test-required = Run the independent connection test for this model first.
zotseek-brief-wizard-template-title = Choose a prompt starting point
zotseek-brief-wizard-template-desc = Personalize the built-in pair or explicitly use it unchanged.
zotseek-brief-wizard-template-personalized-title = Create my prompts
zotseek-brief-wizard-template-personalized-desc = Answer three short questions so the model can make constrained changes to both built-in templates.
zotseek-brief-wizard-template-bundled-title = Skip guidance and use built-in templates
zotseek-brief-wizard-template-bundled-desc = The built-ins target psychology, developmental psychology, and cognitive neuroscience, and output Chinese by default.
zotseek-brief-wizard-questions-title = Tell us how you read
zotseek-brief-wizard-questions-desc = Your answers modify the built-in pair; they do not ask the model to create prompts from scratch.
zotseek-brief-wizard-domain-example = Examples: computational social science, cancer immunology, or educational technology.
zotseek-brief-wizard-focus-example = Optional. For example: emphasize methods and key values; preserve definitions and original citation leads.
zotseek-brief-wizard-confirm-title = Confirm generation settings
zotseek-brief-wizard-confirm-desc = Review the preference summary. No papers or notes are read during generation.
zotseek-brief-wizard-confirm-disclosure = The model rewrites both built-in templates and must return exactly the standard and review prompts.
zotseek-brief-wizard-summary = Provider: { $provider } | Model: { $model } | Field: { $domain } | Language: { $language } | Focus: { $focus }
zotseek-brief-wizard-summary-none = None
zotseek-brief-wizard-result-title = Brief setup complete
zotseek-brief-wizard-bundled-success = The built-in prompt pair is active. You can reopen the guide or import custom prompts later.
zotseek-brief-wizard-progress = Step { $current } of { $total }
zotseek-brief-wizard-back = Back
zotseek-brief-wizard-next = Next
zotseek-brief-wizard-generate = Generate and enable
zotseek-brief-wizard-finish = Finish
zotseek-brief-skip-reason-garbled-text = PDF text is too garbled to understand reliably
zotseek-pref-brief-model-needs-test = connection test required
zotseek-brief-wizard-service-restored = The current provider and model passed the test. Your existing prompts remain active and brief setup is ready.
zotseek-brief-wizard-setup-damaged = The existing prompt setup needs repair. Choose the built-in prompts or create a new pair to continue.
