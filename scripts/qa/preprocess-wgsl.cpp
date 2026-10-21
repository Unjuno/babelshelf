// QA harness for the exact upstream preprocessor, not a replacement parser.
#include "pre_wgsl.hpp"
#include <iostream>
int main(int argc,char **argv){
 try{
  if(argc<4)throw std::runtime_error("Use SHADER_DIRECTORY FILE OUTPUT [DEFINES...]");
  pre_wgsl::Options opts;opts.include_path=argv[1];
  pre_wgsl::Preprocessor processor(opts);std::vector<std::string> defines;
  for(int i=4;i<argc;i++)defines.emplace_back(argv[i]);
  std::ofstream out(argv[3]);if(!out)throw std::runtime_error("Output unavailable");
  out<<processor.preprocess_file(std::string(argv[1])+"/"+argv[2],defines);if(!out)throw std::runtime_error("Output failed");
 }catch(const std::exception &e){std::cerr<<e.what()<<"\n";return 1;}
}
