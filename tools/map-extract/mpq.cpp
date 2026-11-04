#include <StormLib.h>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <string>
namespace fs = std::filesystem;
// usage: mpq x <archive> <outdir> | mpq a <archive> <file> <name> | mpq l <archive>
// Archive entry names are untrusted data: names that are absolute, contain a drive colon or a ".."
// component are skipped, and folders are created without a shell.

static bool safe_name(const std::string& n){
  if(n.empty() || n[0]=='/' || n.find(':')!=std::string::npos) return false;
  size_t s=0;
  while(s<=n.size()){
    size_t e=n.find('/',s); if(e==std::string::npos) e=n.size();
    if(e-s==2 && n.compare(s,2,"..")==0) return false;
    s=e+1;
  }
  return true;
}

int main(int argc,char**argv){
  if(argc<3){printf("usage: mpq x <archive> <outdir> | mpq a <archive> <file> <name> | mpq l <archive>\n");return 2;}
  std::string m=argv[1]; HANDLE h;
  if(m=="x"){
    if(argc<4){printf("usage: mpq x <archive> <outdir>\n");return 2;}
    if(!SFileOpenArchive(argv[2],0,MPQ_OPEN_READ_ONLY,&h)){printf("open fail %d\n",SErrGetLastError());return 1;}
    SFILE_FIND_DATA fd; HANDLE f=SFileFindFirstFile(h,"*",&fd,NULL); int n=0,bad=0,skip=0;
    if(f){do{
      std::string name=fd.cFileName; for(auto&c:name) if(c=='\\') c='/';
      if(!safe_name(name)){skip++; printf("SKIP unsafe name %s\n",fd.cFileName); continue;}
      fs::path out=fs::path(argv[3])/name;
      std::error_code ec; fs::create_directories(out.parent_path(),ec);
      if(SFileExtractFile(h,fd.cFileName,out.string().c_str(),0)) n++; else {bad++; printf("FAIL %s\n",fd.cFileName);}
    }while(SFileFindNextFile(f,&fd)); SFileFindClose(f);}
    printf("extracted %d failed %d skipped %d\n",n,bad,skip); SFileCloseArchive(h); return 0;
  }
  if(m=="a"){
    if(argc<5){printf("usage: mpq a <archive> <file> <name>\n");return 2;}
    if(!SFileOpenArchive(argv[2],0,0,&h)){printf("open fail %d\n",SErrGetLastError());return 1;}
    SFileRemoveFile(h,argv[4],0);
    bool ok=SFileAddFileEx(h,argv[3],argv[4],MPQ_FILE_COMPRESS|MPQ_FILE_REPLACEEXISTING,MPQ_COMPRESSION_ZLIB,MPQ_COMPRESSION_NEXT_SAME);
    printf("add %s: %s (err %d)\n",argv[4],ok?"ok":"FAIL",ok?0:SErrGetLastError());
    SFileCompactArchive(h,NULL,false); SFileCloseArchive(h); return ok?0:1;
  }
  if(m=="l"){
    if(!SFileOpenArchive(argv[2],0,MPQ_OPEN_READ_ONLY,&h)){printf("open fail\n");return 1;}
    SFILE_FIND_DATA fd; HANDLE f=SFileFindFirstFile(h,"*",&fd,NULL);
    if(f){do{printf("%s %u\n",fd.cFileName,fd.dwFileSize);}while(SFileFindNextFile(f,&fd)); SFileFindClose(f);}
    SFileCloseArchive(h); return 0;
  }
  printf("unknown mode %s\n",m.c_str()); return 2;
}
