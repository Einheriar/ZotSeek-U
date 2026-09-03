# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## Cloud embedding and Local Server naming

zotseek-pref-localServerReady = Local Server ({ $model })
zotseek-pref-localServerState = Local Server ({ $state })
zotseek-pref-cloudSlotReady = Cloud ({ $model })
zotseek-pref-cloudSlotSetup = Cloud (SETUP REQUIRED)
zotseek-pref-cloudTitle = Cloud Model
zotseek-pref-cloudDesc = Configure a BYOK Cloud embedding provider. Indexed content and semantic queries are sent to the provider and may incur provider charges. ZotSeek does not charge or receive any share of those fees.
zotseek-pref-cloudProvider = Provider
zotseek-pref-cloudBaseUrl = Base URL
zotseek-pref-cloudModel = Model
zotseek-pref-cloudDimensions = Dimensions
zotseek-pref-cloudAdvanced = Advanced model parameters
zotseek-pref-cloudMaxInputTokens = Maximum input Tokens
zotseek-pref-cloudRecommendedChunkTokens = Recommended Chunk Tokens
zotseek-pref-cloudQueryPrefix = Query Prefix
zotseek-pref-cloudDocumentPrefix = Document Prefix
zotseek-pref-cloudBatchSize = Maximum inputs per batch
zotseek-pref-cloudRecommendedChunkDesc = Automatically uses 85% of the model limit, capped at 3000 Tokens.
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
zotseek-pref-cloudApiKeyPromptMessage = Paste your Alibaba Bailian API Key. It will be encrypted using Zotero secure credential storage and will not be written to preferences, configuration files, or logs.
zotseek-pref-cloudRemoveApiKeyTitle = Remove Cloud API Key
zotseek-pref-cloudRemoveApiKeyMessage = Remove the saved Cloud API Key? If Cloud is active, ZotSeek will switch back to the built-in E5 model.
zotseek-pref-cloudConsentTitle = Send embedding content to a Cloud provider?
zotseek-pref-cloudConsentMessage = When Cloud is selected, ZotSeek sends content included by the current indexing mode and every semantic or Hybrid query to Alibaba Cloud Model Studio (Bailian). You must provide your own API Key (BYOK). The provider may charge your account; all fees are paid only to the provider. ZotSeek does not charge, receive a share, or participate in billing. A connection test sends fixed probe text and may also incur a very small provider charge. Continue?
zotseek-pref-cloudRebuildTitle = Index remaining papers with Cloud?
zotseek-pref-cloudRebuildMessage = This will send content from { $count } eligible papers to the configured Cloud provider. Provider charges may apply. Continue?
## Context menu items

zotseek-menu-findSimilar = ค้นหาเอกสารที่คล้ายกัน
zotseek-menu-openZotSeek = เปิด ZotSeek…
zotseek-menu-indexSelected = ตรวจสอบและอัปเดตรายการที่เลือก
zotseek-menu-indexCollection = ตรวจสอบและอัปเดตคอลเลกชันปัจจุบัน
zotseek-menu-updateLibrary = ตรวจสอบและอัปเดตดัชนี
zotseek-menu-removeFromIndex = ลบออกจากดัชนี ZotSeek
zotseek-menu-findRelated = ค้นหาเอกสารที่เกี่ยวข้อง

## Toolbar

zotseek-toolbar-openZotSeek = เปิด ZotSeek
zotseek-toolbar-findSimilar = ค้นหาเอกสารที่คล้ายกัน

## Preference pane

zotseek-pref-title = ZotSeek
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
zotseek-pref-abstractSpeed = เร็ว • ประมาณ 1 ชิ้นข้อมูลต่อเอกสาร
zotseek-pref-abstractDesc = จัดทำดัชนีชื่อเรื่องและบทคัดย่อ เหมาะสำหรับค้นหาเอกสารตามหัวข้อ
zotseek-pref-notes = ข้อมูลเมทาดาทา + โน้ต
zotseek-pref-notesMenu =
    .label = ข้อมูลเมทาดาทา + โน้ต (ไม่ประมวลผล PDF)
zotseek-pref-notesSpeed = เน้นเฉพาะสาระ • ไม่ประมวลผล PDF
zotseek-pref-notesDesc = จัดทำดัชนีชื่อเรื่อง บทคัดย่อ แท็ก และโน้ตลูก
zotseek-pref-fullPaper = เอกสารฉบับเต็ม
zotseek-pref-fullPaperMenu =
    .label = เอกสารฉบับเต็ม (ละเอียดกว่า)
zotseek-pref-fullSpeed = ละเอียด • โน้ต + ประมาณ 1–2 ชิ้นข้อมูลต่อหน้า PDF
zotseek-pref-fullDesc = จัดทำดัชนีชื่อเรื่อง บทคัดย่อ แท็ก โน้ตลูก และเนื้อหา PDF ฉบับเต็มพร้อมเลขหน้า
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
zotseek-pref-excludeBooksDesc = จะไม่จัดทำดัชนีหนังสือ ดัชนี ZotSeek ที่มีอยู่สำหรับหนังสือจะถูกลบในการตรวจสอบดัชนีครั้งถัดไป
zotseek-pref-excludeTag = แท็กที่ยกเว้น
zotseek-pref-excludeTagDesc = รายการที่มีแท็กนี้จะไม่ถูกจัดทำดัชนี ดัชนี ZotSeek ที่มีอยู่สำหรับรายการที่ตรงกันจะถูกลบในการตรวจสอบดัชนีครั้งถัดไป เว้นว่างเพื่อปิดใช้งาน
zotseek-pref-actions = การดำเนินการ
zotseek-pref-maintenanceRepair = การบำรุงรักษาและซ่อมแซม
zotseek-pref-updateIndex =
    .label = ตรวจสอบและอัปเดตดัชนี
zotseek-pref-recommended = ✓ แนะนำ
zotseek-pref-updateIndexDesc = เพิ่มรายการที่ขาดหาย อัปเดตรายการที่เมทาดาทา โน้ต หรือการตั้งค่าการจัดทำดัชนีเปลี่ยนแปลง ข้ามรายการที่ไม่เปลี่ยนแปลง และลบระเบียนของรายการที่ลบจาก Zotero หรือถูกยกเว้นตามกฎการจัดทำดัชนี การเปลี่ยนการตั้งค่าการจัดทำดัชนีอาจคำนวณรายการเดิมใหม่
zotseek-pref-rebuildIndex =
    .label = สร้างดัชนีใหม่
zotseek-pref-rebuildIndexDesc = ล้างและจัดทำดัชนีรายการทั้งหมดใหม่ด้วยการตั้งค่าปัจจุบัน ใช้หลังเปลี่ยนโหมดการจัดทำดัชนีหรือกลยุทธ์การแบ่งชิ้นข้อมูล หรือเมื่อต้องการจัดทำดัชนีใหม่ทั้งหมด
zotseek-pref-clearIndex =
    .label = ล้างดัชนี
zotseek-pref-dangerZone = พื้นที่อันตราย
zotseek-pref-destructive = ⚠ ทำลายข้อมูล
zotseek-pref-clearIndexDesc = ลบ embedding ทั้งหมดออกจากฐานข้อมูล คุณจะต้องจัดทำดัชนีใหม่ภายหลัง
zotseek-pref-about = เกี่ยวกับ
zotseek-pref-githubRepo =
    .value = ที่เก็บ GitHub Fork
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
    .placeholder = ป้อนคำค้นหา (ค้นหาอัตโนมัติขณะพิมพ์)…
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
zotseek-indexing-rebuildConfirmMsg = การดำเนินการนี้จะลบ embedding ที่จัดเก็บไว้ทั้งหมดและสร้างดัชนีใหม่ด้วยการตั้งค่าปัจจุบัน
zotseek-indexing-rebuildConfirmButton = สร้างดัชนีใหม่
zotseek-indexing-chunkStrategyRebuildRequired = ZotSeek ตรวจพบว่าดัชนีของโมเดลปัจจุบันใช้กลยุทธ์การแบ่งชิ้นข้อมูลรุ่นเก่า
    ดัชนีที่มีอยู่ยังค้นหาได้ แต่จะหยุดการอัปเดตส่วนเพิ่มเบื้องหลังเพื่อป้องกันการผสมชิ้นข้อมูลเก่าและใหม่ ใช้ “สร้างดัชนีใหม่” ในการตั้งค่าเพื่อสร้างใหม่ทั้งหมด การปิดประกาศนี้จะไม่เริ่มสร้างใหม่และไม่แก้ไขดัชนีที่มีอยู่
    การสร้างดัชนีใหม่อาจใช้เวลาตั้งแต่หลายสิบนาทีถึงหลายชั่วโมง ขึ้นอยู่กับขนาดไลบรารีและกลยุทธ์การสร้างดัชนี
zotseek-indexing-rebuildingTitle = กำลังสร้างดัชนี ZotSeek ใหม่
zotseek-indexing-clearingExisting = กำลังล้างดัชนีที่มีอยู่…
zotseek-indexing-existingCleared = ✓ ล้างดัชนีที่มีอยู่แล้ว
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
