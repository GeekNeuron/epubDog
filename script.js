document.addEventListener('DOMContentLoaded', () => {
    // --- انتخاب عناصر DOM ---
    const appHeader = document.getElementById('app-header');
    const themeToggleButton = document.getElementById('app-header');
    const epubUpload = document.getElementById('epub-upload');
    const newBookBtn = document.getElementById('new-book-btn');
    const downloadBtn = document.getElementById('download-btn');
    
    const viewerArea = document.getElementById('viewer-area');
    const editorArea = document.getElementById('editor-area');
    const viewer = document.getElementById('viewer');
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');

    const bookTitleInput = document.getElementById('book-title');
    const bookAuthorInput = document.getElementById('book-author');
    const chapterList = document.getElementById('chapter-list');
    const addChapterBtn = document.getElementById('add-chapter-btn');
    const editor = document.getElementById('editor');
    const specialKeys = document.querySelector('.special-keys');

    // --- وضعیت برنامه ---
    let book;
    let rendition;
    let currentBookData = { title: '', author: '', chapters: [] };
    let activeChapterIndex = -1;

    // --- مدیریت تم (روشن/تاریک) ---
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    };

    themeToggleButton.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // بارگذاری تم ذخیره شده در شروع
    applyTheme(localStorage.getItem('theme'));

    // --- نمایشگر کتاب ---
    const showViewer = () => {
        viewerArea.classList.remove('hidden');
        editorArea.classList.add('hidden');
    };

    epubUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                showViewer();
                if (book) book.destroy();
                book = ePub(e.target.result);
                rendition = book.renderTo(viewer, { width: '100%', height: '100%' });
                rendition.display();

                prevBtn.onclick = () => rendition.prev();
                nextBtn.onclick = () => rendition.next();
            };
            reader.readAsArrayBuffer(file);
        }
    });

    // --- ویرایشگر کتاب ---
    const showEditor = () => {
        viewerArea.classList.add('hidden');
        editorArea.classList.remove('hidden');
    };
    
    const saveToLocalStorage = () => {
        localStorage.setItem('currentBookData', JSON.stringify(currentBookData));
    };

    const loadFromLocalStorage = () => {
        const savedData = localStorage.getItem('currentBookData');
        if (savedData) {
            currentBookData = JSON.parse(savedData);
            if (currentBookData.chapters.length === 0) {
                 createNewChapter();
            }
        } else {
             createNewChapter();
        }
        renderEditor();
    };
    
    const renderEditor = () => {
        bookTitleInput.value = currentBookData.title;
        bookAuthorInput.value = currentBookData.author;
        renderChapterList();
        if (activeChapterIndex >= 0 && currentBookData.chapters[activeChapterIndex]) {
            editor.innerHTML = currentBookData.chapters[activeChapterIndex].content;
        } else {
            editor.innerHTML = '';
        }
    };

    const renderChapterList = () => {
        chapterList.innerHTML = '';
        currentBookData.chapters.forEach((chapter, index) => {
            const li = document.createElement('li');
            li.textContent = chapter.title || `فصل ${index + 1}`;
            li.dataset.index = index;
            if (index === activeChapterIndex) {
                li.classList.add('active');
            }
            
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'delete-chapter';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`آیا از حذف فصل "${chapter.title}" مطمئنید؟`)) {
                    deleteChapter(index);
                }
            };
            li.appendChild(deleteBtn);

            li.onclick = () => selectChapter(index);
            chapterList.appendChild(li);
        });
    };
    
    const createNewChapter = (title = `فصل جدید`) => {
         const newChapter = { title: `${title} ${currentBookData.chapters.length + 1}`, content: '<p>اینجا بنویسید...</p>' };
         currentBookData.chapters.push(newChapter);
         selectChapter(currentBookData.chapters.length - 1);
    };

    const deleteChapter = (index) => {
        currentBookData.chapters.splice(index, 1);
        if (currentBookData.chapters.length === 0) {
            activeChapterIndex = -1;
            editor.innerHTML = '';
        } else if (activeChapterIndex >= index) {
            activeChapterIndex = Math.max(0, activeChapterIndex - 1);
        }
        renderEditor();
        saveToLocalStorage();
    };

    const selectChapter = (index) => {
        // Save current chapter's content before switching
        if (activeChapterIndex >= 0 && currentBookData.chapters[activeChapterIndex]) {
            currentBookData.chapters[activeChapterIndex].content = editor.innerHTML;
        }
        activeChapterIndex = index;
        renderEditor();
    };

    newBookBtn.addEventListener('click', () => {
        showEditor();
        if (!localStorage.getItem('currentBookData')) {
             loadFromLocalStorage();
        }
    });

    addChapterBtn.addEventListener('click', () => {
        createNewChapter();
    });

    bookTitleInput.addEventListener('input', () => {
        currentBookData.title = bookTitleInput.value;
        saveToLocalStorage();
    });

    bookAuthorInput.addEventListener('input', () => {
        currentBookData.author = bookAuthorInput.value;
        saveToLocalStorage();
    });
    
    editor.addEventListener('input', () => {
        if(activeChapterIndex >= 0 && currentBookData.chapters[activeChapterIndex]){
            currentBookData.chapters[activeChapterIndex].content = editor.innerHTML;
            saveToLocalStorage();
        }
    });
    
    // -- دکمه های ویژه ویرایشگر --
    specialKeys.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const key = e.target.dataset.key;
            editor.focus();
            switch(key) {
                case 'zwnj':
                    document.execCommand('insertHTML', false, '&zwnj;');
                    break;
                case 'h1':
                case 'h2':
                case 'p':
                     document.execCommand('formatBlock', false, key);
                     break;
                case 'bold':
                     document.execCommand('bold');
                     break;
                case 'italic':
                     document.execCommand('italic');
                     break;
            }
        }
    });


    // --- منطق ساخت و دانلود EPUB با JSZip ---
    downloadBtn.addEventListener('click', async () => {
        if (!currentBookData.title || currentBookData.chapters.length === 0) {
            alert('لطفاً عنوان کتاب و حداقل یک فصل را وارد کنید.');
            return;
        }

        const zip = new JSZip();
        const OEBPS = zip.folder("OEBPS");

        // 1. فایل mimetype
        zip.file("mimetype", "application/epub+zip", {compression: "STORE"});

        // 2. فایل container.xml
        zip.folder("META-INF").file("container.xml", `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`);

        // 3. فایل های فصل ها و استایل
        const manifestItems = [];
        const spineItems = [];
        currentBookData.chapters.forEach((chapter, index) => {
            const filename = `chapter${index + 1}.xhtml`;
            const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fa" lang="fa">
<head>
    <title>${chapter.title}</title>
    <link href="style.css" rel="stylesheet" type="text/css"/>
</head>
<body>
    <h1>${chapter.title}</h1>
    ${chapter.content}
</body>
</html>`;
            OEBPS.file(filename, content);
            manifestItems.push(`<item id="chapter${index + 1}" href="${filename}" media-type="application/xhtml+xml"/>`);
            spineItems.push(`<itemref idref="chapter${index + 1}"/>`);
        });

        OEBPS.file("style.css", `body { font-family: sans-serif; line-height: 1.6; } h1 { text-align: center; }`);
        manifestItems.push(`<item id="css" href="style.css" media-type="text/css"/>`);
        
        // 4. فایل content.opf
        const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>${currentBookData.title}</dc:title>
        <dc:creator>${currentBookData.author || 'Unknown'}</dc:creator>
        <dc:language>fa</dc:language>
        <meta property="dcterms:modified">${new Date().toISOString().split('.')[0] + 'Z'}</meta>
    </metadata>
    <manifest>
        <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        ${manifestItems.join('\n        ')}
    </manifest>
    <spine>
        ${spineItems.join('\n        ')}
    </spine>
</package>`;
        OEBPS.file("content.opf", contentOpf);
        
        // 5. فایل nav.xhtml (Table of Contents)
        const navPoints = currentBookData.chapters.map((chap, i) => `<li><a href="chapter${i+1}.xhtml">${chap.title}</a></li>`).join('\n');
        const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="fa">
<head>
    <title>Table of Contents</title>
</head>
<body>
    <nav epub:type="toc" id="toc">
        <h2>فهرست مطالب</h2>
        <ol>
            ${navPoints}
        </ol>
    </nav>
</body>
</html>`;
        OEBPS.file("nav.xhtml", navXhtml);

        // 6. ساخت و دانلود فایل نهایی
        const blob = await zip.generateAsync({
            type: "blob",
            mimeType: "application/epub+zip"
        });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${currentBookData.title.replace(/\s+/g, '_') || 'ebook'}.epub`;
        link.click();
        URL.revokeObjectURL(link.href);
    });

    // --- مقداردهی اولیه برنامه ---
    loadFromLocalStorage(); // بارگذاری داده های قبلی
    // به طور پیش فرض ویرایشگر را نشان بده اگر کتابی آپلود نشده باشد
    if (!epubUpload.files || epubUpload.files.length === 0) {
        showEditor();
    }
});
